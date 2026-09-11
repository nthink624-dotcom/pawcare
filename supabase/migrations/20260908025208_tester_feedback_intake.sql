-- Source-only tester feedback intake for the server-authoritative pilot cohort.
-- Apply only through a separately approved Development/Production migration gate.

create table if not exists public.tester_feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  category text not null check (category in ('bug', 'improvement')),
  body text not null check (char_length(body) between 10 and 2000),
  screen_key text not null check (screen_key in (
    'home', 'schedule', 'calendar', 'customers', 'staff', 'services',
    'shop_settings', 'booking_page', 'notifications', 'billing', 'other'
  )),
  app_version text not null check (
    char_length(app_version) between 1 and 32
    and app_version ~ '^[0-9A-Za-z._+-]+$'
  ),
  status text not null default 'new' check (status in ('new', 'reviewing', 'resolved')),
  request_fingerprint char(64) not null check (request_fingerprint ~ '^[0-9a-f]{64}$'),
  content_fingerprint char(64) not null check (content_fingerprint ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  unique (shop_id, owner_user_id, request_id)
);

create index if not exists tester_feedback_submissions_inbox_idx
  on public.tester_feedback_submissions(created_at desc);
create index if not exists tester_feedback_submissions_rate_idx
  on public.tester_feedback_submissions(shop_id, owner_user_id, created_at desc);

alter table public.tester_feedback_submissions enable row level security;
revoke all on public.tester_feedback_submissions from public, anon, authenticated;
grant select, insert, update on public.tester_feedback_submissions to service_role;

create or replace function public.submit_tester_feedback_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_request_id uuid,
  p_category text,
  p_body text,
  p_screen_key text,
  p_app_version text
) returns table (
  feedback_id uuid,
  feedback_status text,
  created_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request_fingerprint char(64);
  v_content_fingerprint char(64);
  v_existing public.tester_feedback_submissions%rowtype;
  v_created public.tester_feedback_submissions%rowtype;
begin
  if p_owner_user_id is null or p_shop_id is null or btrim(p_shop_id) = '' or p_request_id is null then
    raise exception 'PM_TESTER_FEEDBACK_REQUEST_INVALID';
  end if;
  if p_category not in ('bug', 'improvement')
     or char_length(p_body) not between 10 and 2000
     or p_body <> btrim(p_body)
     or p_screen_key not in (
       'home', 'schedule', 'calendar', 'customers', 'staff', 'services',
       'shop_settings', 'booking_page', 'notifications', 'billing', 'other'
     )
     or char_length(p_app_version) not between 1 and 32
     or p_app_version !~ '^[0-9A-Za-z._+-]+$' then
    raise exception 'PM_TESTER_FEEDBACK_PAYLOAD_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    pg_catalog.hashtextextended('tester_feedback:' || p_owner_user_id::text || ':' || p_shop_id, 0)
  );

  v_request_fingerprint := encode(
    extensions.digest(p_category || E'\n' || p_body || E'\n' || p_screen_key || E'\n' || p_app_version, 'sha256'),
    'hex'
  );
  select submission.* into v_existing
    from public.tester_feedback_submissions submission
   where submission.shop_id = p_shop_id
     and submission.owner_user_id = p_owner_user_id
     and submission.request_id = p_request_id;
  if found then
    if v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception 'PM_TESTER_FEEDBACK_IDEMPOTENCY_CONFLICT';
    end if;
    return query select v_existing.id, v_existing.status, v_existing.created_at, true;
    return;
  end if;

  if not exists (
    select 1
      from public.owner_shop_memberships membership
      join public.owner_pilot_cohort_memberships cohort
        on cohort.shop_id = membership.shop_id
       and cohort.owner_user_id = membership.owner_user_id
     where membership.shop_id = p_shop_id
       and membership.owner_user_id = p_owner_user_id
       and membership.role = 'owner'
       and cohort.status <> 'excluded'
  ) then
    raise exception 'PM_TESTER_FEEDBACK_MEMBER_REQUIRED';
  end if;

  v_content_fingerprint := encode(extensions.digest(p_category || E'\n' || p_body || E'\n' || p_screen_key, 'sha256'), 'hex');
  select submission.* into v_existing
    from public.tester_feedback_submissions submission
   where submission.shop_id = p_shop_id
     and submission.owner_user_id = p_owner_user_id
     and submission.content_fingerprint = v_content_fingerprint
     and submission.created_at >= clock_timestamp() - interval '10 minutes'
   order by submission.created_at desc
   limit 1;
  if found then
    return query select v_existing.id, v_existing.status, v_existing.created_at, true;
    return;
  end if;

  if (
    select count(*)
      from public.tester_feedback_submissions submission
     where submission.shop_id = p_shop_id
       and submission.owner_user_id = p_owner_user_id
       and submission.created_at >= clock_timestamp() - interval '1 hour'
  ) >= 5 or (
    select count(*)
      from public.tester_feedback_submissions submission
     where submission.shop_id = p_shop_id
       and submission.owner_user_id = p_owner_user_id
       and submission.created_at >= clock_timestamp() - interval '24 hours'
  ) >= 20 then
    raise exception 'PM_TESTER_FEEDBACK_RATE_LIMIT';
  end if;

  insert into public.tester_feedback_submissions (
    shop_id, owner_user_id, request_id, category, body, screen_key, app_version,
    status, request_fingerprint, content_fingerprint
  ) values (
    p_shop_id, p_owner_user_id, p_request_id, p_category, p_body, p_screen_key, p_app_version,
    'new', v_request_fingerprint, v_content_fingerprint
  ) returning * into v_created;

  return query select v_created.id, v_created.status, v_created.created_at, false;
end;
$$;

revoke all on function public.submit_tester_feedback_v1(uuid, text, uuid, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_tester_feedback_v1(uuid, text, uuid, text, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
