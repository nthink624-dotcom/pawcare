-- Provider-neutral caller ID foundation. Apply only after a separately approved
-- development/production database change. Raw phone numbers and call payloads
-- are deliberately not stored.

create table if not exists public.call_integrations (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  provider text not null check (provider in ('kt_call_manager', 'generic')),
  line_type text not null check (line_type in ('landline', 'mobile')),
  external_line_id text not null check (char_length(btrim(external_line_id)) between 1 and 160),
  webhook_token_hash char(64) not null check (webhook_token_hash ~ '^[0-9a-f]{64}$'),
  webhook_token_last4 char(4) not null check (webhook_token_last4 ~ '^[A-Za-z0-9_-]{4}$'),
  enabled boolean not null default true,
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (provider, external_line_id)
);

create index if not exists call_integrations_shop_idx on public.call_integrations(shop_id, enabled);

create table if not exists public.call_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  integration_id uuid not null references public.call_integrations(id) on delete cascade,
  provider_event_id text not null check (char_length(btrim(provider_event_id)) between 1 and 160),
  event_type text not null check (event_type in ('incoming', 'missed', 'answered', 'ended')),
  direction text not null check (direction in ('inbound', 'outbound')),
  phone_fingerprint char(64) not null check (phone_fingerprint ~ '^[0-9a-f]{64}$'),
  phone_tail char(4) not null check (phone_tail ~ '^[0-9]{4}$'),
  occurred_at timestamptz not null,
  matched_guardian_id uuid references public.guardians(id) on delete set null,
  match_status text not null check (match_status in ('matched', 'unmatched', 'ambiguous')),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default clock_timestamp(),
  unique (integration_id, provider_event_id)
);

create index if not exists call_events_shop_occurred_idx
  on public.call_events(shop_id, occurred_at desc);
create index if not exists call_events_shop_match_idx
  on public.call_events(shop_id, match_status, occurred_at desc);

create or replace function public.assert_call_event_tenant_v1()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.call_integrations integration
     where integration.id = new.integration_id
       and integration.shop_id = new.shop_id
  ) then
    raise exception 'PM_CALL_EVENT_INTEGRATION_SHOP_MISMATCH';
  end if;

  if new.matched_guardian_id is not null and not exists (
    select 1 from public.guardians guardian
     where guardian.id = new.matched_guardian_id
       and guardian.shop_id = new.shop_id
  ) then
    raise exception 'PM_CALL_EVENT_GUARDIAN_SHOP_MISMATCH';
  end if;

  return new;
end;
$$;

drop trigger if exists call_events_tenant_guard on public.call_events;
create trigger call_events_tenant_guard
before insert or update on public.call_events
for each row execute function public.assert_call_event_tenant_v1();

revoke all on function public.assert_call_event_tenant_v1() from public, anon, authenticated;
grant execute on function public.assert_call_event_tenant_v1() to service_role;

alter table public.call_integrations enable row level security;
alter table public.call_events enable row level security;
revoke all on public.call_integrations from public, anon, authenticated;
revoke all on public.call_events from public, anon, authenticated;
grant select, insert, update on public.call_integrations to service_role;
grant select, insert on public.call_events to service_role;

comment on table public.call_integrations is
  'Provider-neutral caller ID connection. Webhook tokens are stored only as keyed hashes.';
comment on table public.call_events is
  'Caller ID event ledger. Stores an HMAC phone fingerprint and last four digits, never the raw caller number or provider payload.';
