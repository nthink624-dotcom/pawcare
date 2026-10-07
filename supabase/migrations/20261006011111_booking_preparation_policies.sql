-- Server-only booking policy, immutable signed snapshots, optimistic transaction boundary.
-- Pending deposit/approval bookings hold their assigned staff window too.
-- Preserve the existing transaction-scoped shop/staff lock.
create or replace function public.prevent_overlapping_staff_appointments()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.staff_id is null or new.status not in ('pending','confirmed','in_progress','almost_done') then return new; end if;
  if new.start_at is null or new.end_at is null or new.start_at >= new.end_at then
    raise exception using errcode='22007',message='appointment time window is invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text || ':' || new.staff_id::text,0));
  if exists (select 1 from public.appointments existing where existing.shop_id=new.shop_id
    and existing.staff_id=new.staff_id and existing.id<>new.id
    and existing.status in ('pending','confirmed','in_progress','almost_done')
    and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(new.start_at,new.end_at,'[)')) then
    raise exception using errcode='23P01',message='appointment overlaps another active appointment for the same staff member';
  end if;
  return new;
end $$;

create table public.shop_booking_policies (
  shop_id text primary key references public.shops(id) on delete cascade,
  version integer not null default 1,
  policy jsonb not null check (jsonb_typeof(policy) = 'object'),
  updated_at timestamptz not null default now()
);
create table public.booking_preparations (
  -- Keep signed documents if an appointment is removed; guardian/shop erasure deletes them.
  appointment_id uuid primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  -- Pet deletion does not erase a guardian's signed history.
  pet_id uuid not null,
  version integer not null default 1,
  data jsonb not null check (jsonb_typeof(data) = 'object'),
  updated_at timestamptz not null default now()
);
create index booking_preparations_guardian_idx on public.booking_preparations(shop_id, guardian_id, pet_id);
create table public.guardian_booking_conditions (
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  rule text not null check (rule in ('normal', 'approval', 'deposit', 'blocked')),
  reason text not null,
  updated_by uuid,
  updated_at timestamptz not null default now(),
  primary key (shop_id, guardian_id)
);
alter table public.shop_booking_policies enable row level security;
alter table public.booking_preparations enable row level security;
alter table public.guardian_booking_conditions enable row level security;
revoke all on public.shop_booking_policies, public.booking_preparations, public.guardian_booking_conditions from anon, authenticated;
grant select, insert, update, delete on public.shop_booking_policies, public.booking_preparations, public.guardian_booking_conditions to service_role;

create function public.prepare_booking_policy() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  p jsonb; pv integer; n integer; rule text; mode text; applies boolean; required boolean;
  consents jsonb := '[]'; t jsonb; signed jsonb; due_at timestamptz;
begin
  if TG_OP = 'UPDATE' then
    if new.status = 'noshow' and old.status <> 'noshow' and (old.status <> 'confirmed' or new.start_at > now()) then
      raise exception 'BOOKING_NOSHOW_NOT_STARTED';
    end if;
    if new.status in ('in_progress','confirmed') and old.status <> new.status then
      select data into p from booking_preparations where appointment_id = new.id;
      if p is not null then
        if coalesce((p#>>'{deposit,required}')::boolean, false)
          and p#>>'{deposit,status}' not in ('confirmed', 'waived') then
          raise exception 'BOOKING_DEPOSIT_REQUIRED';
        end if;
        if new.status = 'in_progress' and coalesce((p#>>'{policy,consentBeforeStart}')::boolean, false) and exists (
          select 1 from jsonb_array_elements(p->'consents') c
          where (c->>'required')::boolean and c->>'status' = 'pending'
        ) then raise exception 'BOOKING_CONSENT_REQUIRED'; end if;
      end if;
    end if;
    return new;
  end if;
  select policy,version into p,pv from shop_booking_policies where shop_id = new.shop_id for share;
  if p is null then return new; end if;
  if new.source = 'customer' and (new.discount_snapshot->>'bookingPolicyVersion')::integer is distinct from pv then
    raise exception 'BOOKING_POLICY_CHANGED';
  end if;
  select count(*) into n from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status = 'noshow';
  rule := case when n >= 2 then p->>'repeatNoshowRule' when n = 1 then p->>'firstNoshowRule' else 'normal' end;
  select c.rule into mode from guardian_booking_conditions c where c.shop_id = new.shop_id and c.guardian_id = new.guardian_id;
  rule := coalesce(mode, rule, 'normal');
  if new.source = 'customer' and rule = 'blocked' then raise exception 'BOOKING_ONLINE_RESTRICTED'; end if;
  applies := p->>'depositAudience' = 'all' or (p->>'depositAudience' = 'noshow' and n > 0)
    or (p->>'depositAudience' = 'new' and not exists (
      select 1 from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status in ('completed','in_progress','almost_done')
    ));
  required := rule = 'deposit' or (p->>'depositMode' = 'required' and applies);
  if required and (coalesce(p->>'bankAccount','') = '' or coalesce((p->>'depositAmount')::integer,0) <= 0) then
    raise exception 'BOOKING_DEPOSIT_NOT_CONFIGURED';
  end if;
  if required or (new.source = 'customer' and rule = 'approval') then new.status := 'pending'; end if;
  -- Snapshot is created AFTER insertion using a separate trigger.
  return new;
end $$;
create trigger booking_policy_guard before insert or update of status on public.appointments
for each row execute function public.prepare_booking_policy();

create function public.snapshot_booking_policy() returns trigger
language plpgsql security invoker set search_path = public as $$
declare p jsonb; pv integer; c jsonb := '[]'; t jsonb; signed jsonb; n integer; rule text; required boolean; applies boolean; due_at timestamptz;
begin
  select policy,version into p,pv from shop_booking_policies where shop_id = new.shop_id;
  if p is null then return new; end if;
  select count(*) into n from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status = 'noshow';
  select b.rule into rule from guardian_booking_conditions b where b.shop_id = new.shop_id and b.guardian_id = new.guardian_id;
  rule := coalesce(rule, case when n >= 2 then p->>'repeatNoshowRule' when n = 1 then p->>'firstNoshowRule' else 'normal' end);
  applies := p->>'depositAudience' = 'all' or (p->>'depositAudience' = 'noshow' and n > 0)
    or (p->>'depositAudience' = 'new' and not exists (
      select 1 from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status in ('completed','in_progress','almost_done')
    ));
  required := rule = 'deposit' or (p->>'depositMode' = 'required' and applies);
  for t in select value from jsonb_array_elements(coalesce(p->'templates','[]')) loop
    if not coalesce((t->>'enabled')::boolean,false) then continue; end if;
    if t->>'audience' = 'manual' then continue; end if;
    if t->>'audience' = 'new' and exists (select 1 from appointments where shop_id=new.shop_id and guardian_id=new.guardian_id and status in ('completed','in_progress','almost_done')) then continue; end if;
    signed := null;
    if t->>'scope' = 'pet' then
      select item into signed from booking_preparations b, lateral jsonb_array_elements(b.data->'consents') item
      where b.shop_id = new.shop_id and b.guardian_id = new.guardian_id and b.pet_id = new.pet_id
        and item->>'id' = t->>'id' and item->>'version' = t->>'version' and item->>'status' = 'signed'
      order by b.updated_at desc limit 1;
    end if;
    c := c || jsonb_build_array(coalesce(signed, t || '{"status":"pending"}'::jsonb));
  end loop;
  due_at := least(now() + make_interval(hours => (p->>'depositDueHours')::integer), new.start_at);
  insert into booking_preparations(appointment_id,shop_id,guardian_id,pet_id,data) values (
    new.id,new.shop_id,new.guardian_id,new.pet_id,
    jsonb_build_object('policy',p,'policyVersion',pv,'approvalRequired',rule='approval' and new.source='customer',
      'guardianName',(select name from guardians where id=new.guardian_id),
      'petName',(select name from pets where id=new.pet_id),'consents',c,'cancellation',null,
      'history',case when new.source='customer' then jsonb_build_array(jsonb_build_object('action','policy_acceptance','at',now(),'actor','customer','note','예약 정책 확인')) else '[]'::jsonb end,'requests','[]'::jsonb,
      'deposit',jsonb_build_object('status',case when required then 'pending' else 'not_requested' end,
        'required',required,'amount',(p->>'depositAmount')::integer,'receivedAmount',0,'refundedAmount',0,
        'dueAt',case when required then due_at else null end,'payerName','','reportedAt',null,'confirmedAt',null,'confirmedBy',null))
  );
  return new;
end $$;
create trigger booking_policy_snapshot after insert on public.appointments
for each row execute function public.snapshot_booking_policy();

create function public.save_booking_preparation(p_shop text,p_appointment uuid,p_version integer,p_data jsonb,p_status text default null,p_rule text default null,p_preferences jsonb default null)
returns integer language plpgsql security invoker set search_path = public as $$
declare b booking_preparations%rowtype; a appointments%rowtype; old_signed jsonb; next_version integer;
begin
  select * into a from appointments where id = p_appointment and shop_id = p_shop for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into b from booking_preparations where appointment_id = p_appointment and shop_id = p_shop for update;
  if not found or b.version <> p_version then raise exception 'BOOKING_VERSION_CONFLICT'; end if;
  for old_signed in select value from jsonb_array_elements(b.data->'consents') where value->>'status' = 'signed' loop
    if not exists (select 1 from jsonb_array_elements(p_data->'consents') x where x = old_signed) then
      raise exception 'BOOKING_SIGNED_DOCUMENT_IMMUTABLE';
    end if;
  end loop;
  update booking_preparations set data = p_data, version = version+1, updated_at = now()
    where appointment_id = p_appointment returning version into next_version;
  if p_status is not null then
    if p_status not in ('pending','confirmed','cancelled','noshow') then raise exception 'BOOKING_INVALID_STATUS'; end if;
    if p_status = 'pending' and a.status <> 'confirmed' then raise exception 'BOOKING_INVALID_TRANSITION'; end if;
    if p_status = 'confirmed' and a.status not in ('pending','noshow') then raise exception 'BOOKING_INVALID_TRANSITION'; end if;
    if p_status in ('cancelled','noshow') and a.status not in ('pending','confirmed') then raise exception 'BOOKING_INVALID_TRANSITION'; end if;
    update appointments set status=p_status,updated_at=now() where id=p_appointment;
  end if;
  if p_rule is not null then
    if p_rule not in ('normal','approval','deposit','blocked') then raise exception 'BOOKING_INVALID_RULE'; end if;
    insert into guardian_booking_conditions(shop_id,guardian_id,rule,reason)
      values (p_shop,a.guardian_id,p_rule,p_data->'history'->(-1)->>'note')
      on conflict (shop_id,guardian_id) do update set rule=excluded.rule,reason=excluded.reason,updated_at=now();
  end if;
  if p_preferences is not null then
    update guardians set notification_settings=jsonb_set(jsonb_set(coalesce(notification_settings,'{}'),
      '{consent_request_enabled}',to_jsonb((p_preferences->>'consent')::boolean)),
      '{deposit_request_enabled}',to_jsonb((p_preferences->>'deposit')::boolean)),updated_at=now()
      where id=a.guardian_id and shop_id=p_shop;
  end if;
  return next_version;
end $$;
revoke execute on function public.prepare_booking_policy(), public.snapshot_booking_policy(), public.save_booking_preparation(text,uuid,integer,jsonb,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_booking_policy(), public.snapshot_booking_policy(), public.save_booking_preparation(text,uuid,integer,jsonb,text,text,jsonb) to service_role;

create function public.sync_preparation_booking_change() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if new.status in ('cancelled','noshow') and old.status <> new.status then
    update booking_preparations set
      data = jsonb_set(
        case when data->'cancellation' = 'null'::jsonb then jsonb_set(data,'{cancellation}',
          jsonb_build_object('kind',case when new.status='noshow' then 'noshow' else 'unclassified' end,
            'reason','예약 상태 변경','at',now())) else data end,
        '{deposit,status}',to_jsonb(case when data#>>'{deposit,status}' in ('pending','reported','not_requested') then 'cancelled' else data#>>'{deposit,status}' end)),
      version=version+1,updated_at=now() where appointment_id=new.id;
  elsif new.start_at is distinct from old.start_at then
    update booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',
      to_jsonb(least(coalesce((data#>>'{deposit,dueAt}')::timestamptz,new.start_at),new.start_at))),
      version=version+1,updated_at=now() where appointment_id=new.id and data#>>'{deposit,status}' in ('pending','reported');
  end if;
  return new;
end $$;
create trigger booking_preparation_status_sync after update of status,start_at on public.appointments
for each row execute function public.sync_preparation_booking_change();
revoke execute on function public.sync_preparation_booking_change() from public,anon,authenticated;
grant execute on function public.sync_preparation_booking_change() to service_role;
