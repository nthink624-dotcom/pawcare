create table public.shop_calendar_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  source text not null default 'manual',
  source_key text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint shop_calendar_events_range check (
    isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at
    and ends_at <= starts_at + interval '366 days'
  ),
  constraint shop_calendar_events_all_day check (
    not all_day or (
      (starts_at at time zone 'Asia/Seoul')::time = time '00:00'
      and (ends_at at time zone 'Asia/Seoul')::time = time '00:00'
    )
  ),
  constraint shop_calendar_events_source check (
    (source = 'manual' and source_key is null)
    or (source = 'ics' and source_key is not null and source_key ~ '^[0-9a-f]{64}$')
  ),
  unique (shop_id, source_key)
);

create index shop_calendar_events_shop_start_idx
  on public.shop_calendar_events (shop_id, starts_at, id);

alter table public.shop_calendar_events enable row level security;
revoke all on table public.shop_calendar_events from public, anon, authenticated;
grant select, insert, update, delete on table public.shop_calendar_events to service_role;
