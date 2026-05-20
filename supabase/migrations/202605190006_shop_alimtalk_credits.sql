create table if not exists public.shop_alimtalk_credit_balances (
  shop_id text primary key references public.shops(id) on delete cascade,
  included_total integer not null default 0 check (included_total >= 0),
  included_used integer not null default 0 check (included_used >= 0),
  included_period_started_at timestamptz,
  included_period_ends_at timestamptz,
  purchased_total integer not null default 0 check (purchased_total >= 0),
  purchased_used integer not null default 0 check (purchased_used >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (included_used <= included_total),
  check (purchased_used <= purchased_total)
);

create table if not exists public.shop_alimtalk_credit_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  notification_id uuid references public.notifications(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  notification_type text,
  event_type text not null check (event_type in ('grant', 'consume', 'refund', 'reset', 'adjustment')),
  credit_bucket text check (credit_bucket in ('included', 'purchased')),
  amount_delta integer not null,
  included_remaining_after integer not null check (included_remaining_after >= 0),
  purchased_remaining_after integer not null check (purchased_remaining_after >= 0),
  balance_after integer not null check (balance_after >= 0),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shop_alimtalk_credit_events_shop_created_at_idx
  on public.shop_alimtalk_credit_events(shop_id, created_at desc);

create index if not exists shop_alimtalk_credit_events_notification_idx
  on public.shop_alimtalk_credit_events(notification_id)
  where notification_id is not null;

create or replace view public.shop_alimtalk_credit_summaries as
select
  balance.shop_id,
  balance.included_total,
  balance.included_used,
  balance.included_total - balance.included_used as included_remaining,
  balance.included_period_started_at,
  balance.included_period_ends_at,
  balance.purchased_total,
  balance.purchased_used,
  balance.purchased_total - balance.purchased_used as purchased_remaining,
  balance.included_total - balance.included_used + balance.purchased_total - balance.purchased_used as remaining_total,
  balance.created_at,
  balance.updated_at
from public.shop_alimtalk_credit_balances balance;

create or replace function public.grant_shop_alimtalk_credits(
  p_shop_id text,
  p_amount integer,
  p_credit_bucket text default 'included',
  p_reason text default 'manual_grant',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  remaining_count integer,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_included_remaining integer;
  v_purchased_remaining integer;
  v_remaining integer;
  v_event_id uuid;
begin
  if p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  if p_credit_bucket not in ('included', 'purchased') then
    raise exception 'credit bucket must be included or purchased';
  end if;

  insert into public.shop_alimtalk_credit_balances (shop_id)
  values (p_shop_id)
  on conflict (shop_id) do nothing;

  update public.shop_alimtalk_credit_balances
  set
    included_total = case when p_credit_bucket = 'included' then included_total + p_amount else included_total end,
    purchased_total = case when p_credit_bucket = 'purchased' then purchased_total + p_amount else purchased_total end,
    updated_at = now()
  where shop_id = p_shop_id
  returning
    included_total - included_used,
    purchased_total - purchased_used,
    included_total - included_used + purchased_total - purchased_used
  into v_included_remaining, v_purchased_remaining, v_remaining;

  insert into public.shop_alimtalk_credit_events (
    shop_id,
    event_type,
    credit_bucket,
    amount_delta,
    included_remaining_after,
    purchased_remaining_after,
    balance_after,
    reason,
    metadata
  )
  values (
    p_shop_id,
    'grant',
    p_credit_bucket,
    p_amount,
    v_included_remaining,
    v_purchased_remaining,
    v_remaining,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return query select v_remaining, v_event_id;
end;
$$;

create or replace function public.reset_shop_alimtalk_included_credits(
  p_shop_id text,
  p_included_amount integer,
  p_period_started_at timestamptz default now(),
  p_period_ends_at timestamptz default null,
  p_reason text default 'monthly_included_reset',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  remaining_count integer,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_previous_remaining integer;
  v_included_remaining integer;
  v_purchased_remaining integer;
  v_remaining integer;
  v_event_id uuid;
begin
  if p_included_amount < 0 then
    raise exception 'included amount must be zero or positive';
  end if;

  insert into public.shop_alimtalk_credit_balances (shop_id)
  values (p_shop_id)
  on conflict (shop_id) do nothing;

  select included_total - included_used
  into v_previous_remaining
  from public.shop_alimtalk_credit_balances
  where shop_id = p_shop_id;

  update public.shop_alimtalk_credit_balances
  set
    included_total = p_included_amount,
    included_used = 0,
    included_period_started_at = p_period_started_at,
    included_period_ends_at = p_period_ends_at,
    updated_at = now()
  where shop_id = p_shop_id
  returning
    included_total - included_used,
    purchased_total - purchased_used,
    included_total - included_used + purchased_total - purchased_used
  into v_included_remaining, v_purchased_remaining, v_remaining;

  insert into public.shop_alimtalk_credit_events (
    shop_id,
    event_type,
    credit_bucket,
    amount_delta,
    included_remaining_after,
    purchased_remaining_after,
    balance_after,
    reason,
    metadata
  )
  values (
    p_shop_id,
    'reset',
    'included',
    v_included_remaining - coalesce(v_previous_remaining, 0),
    v_included_remaining,
    v_purchased_remaining,
    v_remaining,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
      || jsonb_build_object(
        'periodStartedAt', p_period_started_at,
        'periodEndsAt', p_period_ends_at
      )
  )
  returning id into v_event_id;

  return query select v_remaining, v_event_id;
end;
$$;

create or replace function public.consume_shop_alimtalk_credit(
  p_shop_id text,
  p_notification_id uuid default null,
  p_appointment_id uuid default null,
  p_notification_type text default null,
  p_reason text default 'alimtalk_send_attempt',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  success boolean,
  remaining_count integer,
  event_id uuid,
  consumed_bucket text,
  fail_reason text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text;
  v_included_remaining integer;
  v_purchased_remaining integer;
  v_remaining integer;
  v_event_id uuid;
begin
  insert into public.shop_alimtalk_credit_balances (shop_id)
  values (p_shop_id)
  on conflict (shop_id) do nothing;

  update public.shop_alimtalk_credit_balances
  set
    included_used = included_used + 1,
    updated_at = now()
  where shop_id = p_shop_id
    and included_total - included_used >= 1
  returning
    'included',
    included_total - included_used,
    purchased_total - purchased_used,
    included_total - included_used + purchased_total - purchased_used
  into v_bucket, v_included_remaining, v_purchased_remaining, v_remaining;

  if not found then
    update public.shop_alimtalk_credit_balances
    set
      purchased_used = purchased_used + 1,
      updated_at = now()
    where shop_id = p_shop_id
      and purchased_total - purchased_used >= 1
    returning
      'purchased',
      included_total - included_used,
      purchased_total - purchased_used,
      included_total - included_used + purchased_total - purchased_used
    into v_bucket, v_included_remaining, v_purchased_remaining, v_remaining;
  end if;

  if not found then
    select
      greatest(included_total - included_used, 0),
      greatest(purchased_total - purchased_used, 0),
      greatest(included_total - included_used, 0) + greatest(purchased_total - purchased_used, 0)
    into v_included_remaining, v_purchased_remaining, v_remaining
    from public.shop_alimtalk_credit_balances
    where shop_id = p_shop_id;

    return query select false, coalesce(v_remaining, 0), null::uuid, null::text, 'insufficient_credits';
    return;
  end if;

  insert into public.shop_alimtalk_credit_events (
    shop_id,
    notification_id,
    appointment_id,
    notification_type,
    event_type,
    credit_bucket,
    amount_delta,
    included_remaining_after,
    purchased_remaining_after,
    balance_after,
    reason,
    metadata
  )
  values (
    p_shop_id,
    p_notification_id,
    p_appointment_id,
    p_notification_type,
    'consume',
    v_bucket,
    -1,
    v_included_remaining,
    v_purchased_remaining,
    v_remaining,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into v_event_id;

  return query select true, v_remaining, v_event_id, v_bucket, null::text;
end;
$$;

create or replace function public.refund_shop_alimtalk_credit(
  p_shop_id text,
  p_source_event_id uuid default null,
  p_notification_id uuid default null,
  p_appointment_id uuid default null,
  p_notification_type text default null,
  p_reason text default 'alimtalk_send_failed',
  p_metadata jsonb default '{}'::jsonb
)
returns table (
  remaining_count integer,
  event_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text;
  v_included_remaining integer;
  v_purchased_remaining integer;
  v_remaining integer;
  v_event_id uuid;
begin
  insert into public.shop_alimtalk_credit_balances (shop_id)
  values (p_shop_id)
  on conflict (shop_id) do nothing;

  select credit_bucket
  into v_bucket
  from public.shop_alimtalk_credit_events
  where id = p_source_event_id
    and shop_id = p_shop_id
    and event_type = 'consume';

  v_bucket := coalesce(v_bucket, 'included');

  if v_bucket = 'purchased' then
    update public.shop_alimtalk_credit_balances
    set
      purchased_used = greatest(purchased_used - 1, 0),
      updated_at = now()
    where shop_id = p_shop_id
    returning
      included_total - included_used,
      purchased_total - purchased_used,
      included_total - included_used + purchased_total - purchased_used
    into v_included_remaining, v_purchased_remaining, v_remaining;
  else
    update public.shop_alimtalk_credit_balances
    set
      included_used = greatest(included_used - 1, 0),
      updated_at = now()
    where shop_id = p_shop_id
    returning
      included_total - included_used,
      purchased_total - purchased_used,
      included_total - included_used + purchased_total - purchased_used
    into v_included_remaining, v_purchased_remaining, v_remaining;
  end if;

  insert into public.shop_alimtalk_credit_events (
    shop_id,
    notification_id,
    appointment_id,
    notification_type,
    event_type,
    credit_bucket,
    amount_delta,
    included_remaining_after,
    purchased_remaining_after,
    balance_after,
    reason,
    metadata
  )
  values (
    p_shop_id,
    p_notification_id,
    p_appointment_id,
    p_notification_type,
    'refund',
    v_bucket,
    1,
    v_included_remaining,
    v_purchased_remaining,
    v_remaining,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('sourceEventId', p_source_event_id)
  )
  returning id into v_event_id;

  return query select v_remaining, v_event_id;
end;
$$;

insert into public.shop_alimtalk_credit_balances (shop_id)
select id
from public.shops
on conflict (shop_id) do nothing;
