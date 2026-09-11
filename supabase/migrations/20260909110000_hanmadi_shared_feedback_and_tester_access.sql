-- Source-only Hanmadi shared feedback and tester access-decision contract.
-- This migration must not be applied without a separate environment approval.

alter table public.tester_feedback_submissions
  drop constraint if exists tester_feedback_submissions_category_check,
  drop constraint if exists tester_feedback_submissions_body_check;

alter table public.tester_feedback_submissions
  add constraint tester_feedback_submissions_category_check
    check (category in ('inquiry', 'improvement', 'bug')),
  add constraint tester_feedback_submissions_body_check
    check (char_length(body) between 2 and 2000),
  add column if not exists screenshot_media_asset_id uuid references public.media_assets(id) on delete set null,
  add column if not exists screenshot_content_type text,
  add column if not exists screenshot_byte_size integer,
  add column if not exists screenshot_consented_at timestamptz,
  add column if not exists screenshot_receipt_fingerprint char(64),
  add column if not exists screenshot_deleted_at timestamptz;

alter table public.tester_feedback_submissions
  drop constraint if exists tester_feedback_submissions_screenshot_contract_check;
alter table public.tester_feedback_submissions
  add constraint tester_feedback_submissions_screenshot_contract_check check (
    (
      screenshot_media_asset_id is null
      and screenshot_content_type is null
      and screenshot_byte_size is null
      and screenshot_consented_at is null
      and screenshot_receipt_fingerprint is null
    ) or (
      screenshot_media_asset_id is not null
      and screenshot_content_type in ('image/jpeg', 'image/png', 'image/webp')
      and screenshot_byte_size between 1 and 5242880
      and screenshot_consented_at is not null
      and screenshot_receipt_fingerprint ~ '^[0-9a-f]{64}$'
    ) or (
      screenshot_media_asset_id is null
      and screenshot_content_type in ('image/jpeg', 'image/png', 'image/webp')
      and screenshot_byte_size between 1 and 5242880
      and screenshot_consented_at is not null
      and screenshot_receipt_fingerprint ~ '^[0-9a-f]{64}$'
    )
  );

create unique index if not exists tester_feedback_submissions_screenshot_asset_uidx
  on public.tester_feedback_submissions(screenshot_media_asset_id)
  where screenshot_media_asset_id is not null;

alter table public.media_assets
  drop constraint if exists media_assets_media_kind_check;
alter table public.media_assets
  add constraint media_assets_media_kind_check check (
    media_kind in (
      'grooming_before', 'grooming_after', 'grooming_result', 'message_image',
      'shop_profile', 'staff_profile', 'price_guide_source', 'feedback_screenshot',
      'customer_shared', 'memo_attachment'
    )
  );

alter table public.owner_pilot_cohort_memberships
  add column if not exists tester_access_decision_state text not null default 'pending',
  add column if not exists tester_access_review_due_at timestamptz,
  add column if not exists tester_access_decided_at timestamptz;

alter table public.owner_pilot_cohort_memberships
  drop constraint if exists owner_pilot_cohort_tester_access_decision_check;
alter table public.owner_pilot_cohort_memberships
  add constraint owner_pilot_cohort_tester_access_decision_check
    check (tester_access_decision_state in ('pending', 'ended', 'converted'));

-- Existing period authority is used only to seed the review date. No billing,
-- cancellation, payment, or access row is changed by this backfill.
update public.owner_pilot_cohort_memberships cohort
   set tester_access_review_due_at = coalesce(
     (
       select claim.free_ends_at
         from public.owner_pilot_benefit_claims claim
        where claim.shop_id = cohort.shop_id
          and claim.user_id = cohort.owner_user_id
     ),
     (
       select subscription.trial_ends_at
         from public.owner_subscriptions subscription
        where subscription.shop_id = cohort.shop_id
          and subscription.user_id = cohort.owner_user_id
     )
   )
 where cohort.tester_access_review_due_at is null;

create table if not exists public.owner_pilot_tester_access_events (
  event_id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  shop_id text not null references public.owner_pilot_cohort_memberships(shop_id) on delete cascade,
  owner_user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action in ('extend_3_days', 'end', 'convert')),
  decision_state_before text not null check (decision_state_before in ('pending', 'ended', 'converted')),
  decision_state_after text not null check (decision_state_after in ('pending', 'ended', 'converted')),
  review_due_at_before timestamptz,
  review_due_at_after timestamptz,
  created_by_admin_email text not null,
  created_at timestamptz not null default clock_timestamp()
);

alter table public.owner_pilot_tester_access_events enable row level security;
revoke all on public.owner_pilot_tester_access_events from public, anon, authenticated;
grant select, insert on public.owner_pilot_tester_access_events to service_role;

create or replace function public.submit_hanmadi_feedback_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_request_id uuid,
  p_category text,
  p_body text,
  p_screen_key text,
  p_app_version text,
  p_screenshot_media_asset_id uuid,
  p_screenshot_content_type text,
  p_screenshot_byte_size integer,
  p_screenshot_consent boolean
) returns table (
  feedback_id uuid,
  feedback_status text,
  created_at timestamptz,
  replayed boolean,
  is_tester boolean,
  screenshot_accepted boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_request_fingerprint char(64);
  v_content_fingerprint char(64);
  v_receipt_fingerprint char(64);
  v_existing public.tester_feedback_submissions%rowtype;
  v_created public.tester_feedback_submissions%rowtype;
  v_media public.media_assets%rowtype;
  v_is_tester boolean;
begin
  if current_user <> 'service_role' then
    raise exception 'PM_HANMADI_SERVICE_ROLE_REQUIRED';
  end if;
  if p_owner_user_id is null or p_shop_id is null or btrim(p_shop_id) = '' or p_request_id is null then
    raise exception 'PM_HANMADI_REQUEST_INVALID';
  end if;
  if p_category not in ('inquiry', 'improvement', 'bug')
     or char_length(p_body) not between 2 and 2000
     or p_body <> btrim(p_body)
     or p_screen_key not in (
       'home', 'schedule', 'calendar', 'customers', 'staff', 'services',
       'shop_settings', 'booking_page', 'notifications', 'billing', 'other'
     )
     or char_length(p_app_version) not between 1 and 32
     or p_app_version !~ '^[0-9A-Za-z._+-]+$' then
    raise exception 'PM_HANMADI_PAYLOAD_INVALID';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('hanmadi:' || p_owner_user_id::text || ':' || p_shop_id, 0)
  );

  v_request_fingerprint := encode(extensions.digest(
    p_category || E'\n' || p_body || E'\n' || p_screen_key || E'\n' || p_app_version || E'\n'
      || coalesce(p_screenshot_media_asset_id::text, '') || E'\n' || coalesce(p_screenshot_consent::text, 'false'),
    'sha256'
  ), 'hex');
  select submission.* into v_existing
    from public.tester_feedback_submissions submission
   where submission.shop_id = p_shop_id
     and submission.owner_user_id = p_owner_user_id
     and submission.request_id = p_request_id;
  if found then
    if v_existing.request_fingerprint <> v_request_fingerprint then
      raise exception 'PM_HANMADI_IDEMPOTENCY_CONFLICT';
    end if;
    select exists (
      select 1 from public.owner_pilot_cohort_memberships cohort
       where cohort.shop_id = p_shop_id
         and cohort.owner_user_id = p_owner_user_id
         and cohort.status <> 'excluded'
    ) into v_is_tester;
    return query select v_existing.id, v_existing.status, v_existing.created_at, true,
      v_is_tester, v_existing.screenshot_media_asset_id is not null;
    return;
  end if;

  if not exists (
    select 1 from public.owner_shop_memberships membership
     where membership.shop_id = p_shop_id
       and membership.owner_user_id = p_owner_user_id
       and membership.role = 'owner'
  ) then
    raise exception 'PM_HANMADI_OWNER_SHOP_REQUIRED';
  end if;

  if p_screenshot_media_asset_id is null then
    if p_screenshot_consent or p_screenshot_content_type is not null or p_screenshot_byte_size is not null then
      raise exception 'PM_HANMADI_SCREENSHOT_CONTRACT_INVALID';
    end if;
  else
    if not p_screenshot_consent
       or p_screenshot_content_type not in ('image/jpeg', 'image/png', 'image/webp')
       or p_screenshot_byte_size not between 1 and 5242880 then
      raise exception 'PM_HANMADI_SCREENSHOT_CONTRACT_INVALID';
    end if;
    select media.* into v_media
      from public.media_assets media
     where media.id = p_screenshot_media_asset_id
       and media.shop_id = p_shop_id
       and media.uploaded_by_user_id = p_owner_user_id
       and media.media_kind = 'feedback_screenshot'
       and media.visibility = 'private'
       and media.status = 'ready'
       and media.deleted_at is null
     for update;
    if not found
       or v_media.content_type <> p_screenshot_content_type
       or v_media.byte_size <> p_screenshot_byte_size then
      raise exception 'PM_HANMADI_SCREENSHOT_NOT_OWNED';
    end if;
    v_receipt_fingerprint := encode(extensions.digest(
      v_media.id::text || E'\n' || v_media.shop_id || E'\n' || v_media.content_type || E'\n' || v_media.byte_size::text,
      'sha256'
    ), 'hex');
  end if;

  v_content_fingerprint := encode(extensions.digest(p_category || E'\n' || p_body || E'\n' || p_screen_key, 'sha256'), 'hex');
  if p_screenshot_media_asset_id is null then
    select submission.* into v_existing
      from public.tester_feedback_submissions submission
     where submission.shop_id = p_shop_id
       and submission.owner_user_id = p_owner_user_id
       and submission.content_fingerprint = v_content_fingerprint
       and submission.created_at >= clock_timestamp() - interval '10 minutes'
     order by submission.created_at desc
     limit 1;
    if found then
      select exists (
        select 1 from public.owner_pilot_cohort_memberships cohort
         where cohort.shop_id = p_shop_id
           and cohort.owner_user_id = p_owner_user_id
           and cohort.status <> 'excluded'
      ) into v_is_tester;
      return query select v_existing.id, v_existing.status, v_existing.created_at, true, v_is_tester, false;
      return;
    end if;
  end if;

  if (
    select count(*) from public.tester_feedback_submissions submission
     where submission.shop_id = p_shop_id
       and submission.owner_user_id = p_owner_user_id
       and submission.created_at >= clock_timestamp() - interval '1 hour'
  ) >= 5 or (
    select count(*) from public.tester_feedback_submissions submission
     where submission.shop_id = p_shop_id
       and submission.owner_user_id = p_owner_user_id
       and submission.created_at >= clock_timestamp() - interval '24 hours'
  ) >= 20 then
    raise exception 'PM_HANMADI_RATE_LIMIT';
  end if;

  insert into public.tester_feedback_submissions (
    shop_id, owner_user_id, request_id, category, body, screen_key, app_version,
    status, request_fingerprint, content_fingerprint, screenshot_media_asset_id,
    screenshot_content_type, screenshot_byte_size, screenshot_consented_at,
    screenshot_receipt_fingerprint
  ) values (
    p_shop_id, p_owner_user_id, p_request_id, p_category, p_body, p_screen_key, p_app_version,
    'new', v_request_fingerprint, v_content_fingerprint, p_screenshot_media_asset_id,
    p_screenshot_content_type, p_screenshot_byte_size,
    case when p_screenshot_media_asset_id is null then null else clock_timestamp() end,
    v_receipt_fingerprint
  ) returning * into v_created;

  select exists (
    select 1 from public.owner_pilot_cohort_memberships cohort
     where cohort.shop_id = p_shop_id
       and cohort.owner_user_id = p_owner_user_id
       and cohort.status <> 'excluded'
  ) into v_is_tester;
  return query select v_created.id, v_created.status, v_created.created_at, false,
    v_is_tester, v_created.screenshot_media_asset_id is not null;
end;
$$;

create or replace function public.decide_hanmadi_tester_access_v1(
  p_owner_user_id uuid,
  p_shop_id text,
  p_action text,
  p_admin_email text,
  p_request_id uuid
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_membership public.owner_pilot_cohort_memberships%rowtype;
  v_existing public.owner_pilot_tester_access_events%rowtype;
  v_before_state text;
  v_before_due timestamptz;
  v_after_state text;
  v_after_due timestamptz;
begin
  if current_user <> 'service_role' then raise exception 'PM_HANMADI_SERVICE_ROLE_REQUIRED'; end if;
  if p_action not in ('extend_3_days', 'end', 'convert') or p_request_id is null then
    raise exception 'PM_HANMADI_TESTER_DECISION_INVALID';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('hanmadi-access:' || p_request_id::text, 0));
  select * into v_existing from public.owner_pilot_tester_access_events where request_id = p_request_id;
  if found then
    if v_existing.shop_id <> p_shop_id or v_existing.owner_user_id <> p_owner_user_id
       or v_existing.action <> p_action or v_existing.created_by_admin_email <> lower(trim(p_admin_email)) then
      raise exception 'PM_HANMADI_IDEMPOTENCY_CONFLICT';
    end if;
    return jsonb_build_object('replayed', true, 'decisionState', v_existing.decision_state_after,
      'reviewDueAt', v_existing.review_due_at_after);
  end if;

  select * into v_membership from public.owner_pilot_cohort_memberships
   where shop_id = p_shop_id and owner_user_id = p_owner_user_id and status <> 'excluded'
   for update;
  if not found then raise exception 'PM_HANMADI_TESTER_REQUIRED'; end if;
  if v_membership.tester_access_decision_state <> 'pending' then
    raise exception 'PM_HANMADI_TESTER_DECISION_FINAL';
  end if;
  v_before_state := v_membership.tester_access_decision_state;
  v_before_due := v_membership.tester_access_review_due_at;
  v_after_state := case p_action when 'end' then 'ended' when 'convert' then 'converted' else 'pending' end;
  v_after_due := case when p_action = 'extend_3_days'
    then greatest(coalesce(v_before_due, clock_timestamp()), clock_timestamp()) + interval '3 days'
    else v_before_due end;

  update public.owner_pilot_cohort_memberships
     set tester_access_decision_state = v_after_state,
         tester_access_review_due_at = v_after_due,
         tester_access_decided_at = case when p_action = 'extend_3_days' then null else clock_timestamp() end,
         updated_at = clock_timestamp()
   where shop_id = p_shop_id and owner_user_id = p_owner_user_id;

  insert into public.owner_pilot_tester_access_events (
    request_id, shop_id, owner_user_id, action, decision_state_before,
    decision_state_after, review_due_at_before, review_due_at_after, created_by_admin_email
  ) values (
    p_request_id, p_shop_id, p_owner_user_id, p_action, v_before_state,
    v_after_state, v_before_due, v_after_due, lower(trim(p_admin_email))
  );
  return jsonb_build_object('replayed', false, 'decisionState', v_after_state, 'reviewDueAt', v_after_due);
end;
$$;

revoke all on function public.submit_hanmadi_feedback_v1(uuid, text, uuid, text, text, text, text, uuid, text, integer, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_hanmadi_feedback_v1(uuid, text, uuid, text, text, text, text, uuid, text, integer, boolean)
  to service_role;
revoke all on function public.decide_hanmadi_tester_access_v1(uuid, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.decide_hanmadi_tester_access_v1(uuid, text, text, text, uuid)
  to service_role;

notify pgrst, 'reload schema';
