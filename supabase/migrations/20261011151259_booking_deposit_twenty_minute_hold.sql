-- New requests only: preserve all historical deposit snapshots and signed documents.
-- Server-only RPC. SKIP LOCKED keeps overlap checks from waiting on an owner confirmation
-- which already holds the appointment row and is waiting for the existing staff advisory lock.
create or replace function public.expire_unreported_booking_deposits(p_shop text, p_appointment uuid default null, p_staff text default null, p_exclude uuid default null)
returns integer language plpgsql security invoker set search_path = '' as $$
declare a public.appointments%rowtype; b public.booking_preparations%rowtype; expired integer := 0; checked_at timestamptz;
begin
  for a in select ap.* from public.appointments ap join public.booking_preparations bp on bp.appointment_id=ap.id and bp.shop_id=ap.shop_id
    where ap.shop_id=p_shop and (p_appointment is null or ap.id=p_appointment)
      and (p_exclude is null or ap.id<>p_exclude)
      and (p_staff is null or ap.staff_id=p_staff) and ap.status in ('pending','confirmed')
      and bp.data#>>'{deposit,releaseIfUnreported}'='true' and bp.data#>>'{deposit,status}'='pending'
      and (bp.data#>>'{deposit,dueAt}')::timestamptz <= clock_timestamp()
    order by ap.id for update of ap skip locked
  loop
    select * into b from public.booking_preparations where appointment_id=a.id and shop_id=p_shop for update;
    checked_at := clock_timestamp();
    if b.data#>>'{deposit,releaseIfUnreported}' is distinct from 'true'
      or b.data#>>'{deposit,status}' is distinct from 'pending'
      or coalesce((b.data#>>'{deposit,receivedAmount}')::integer,0)>0
      or b.data#>>'{deposit,dueAt}' is null
      or (b.data#>>'{deposit,dueAt}')::timestamptz>checked_at then continue; end if;
    b.data := jsonb_set(jsonb_set(b.data,'{deposit,status}','"cancelled"'),'{cancellation}',
      jsonb_build_object('kind','deposit_expired','reason','입금 신고 기한 경과로 예약 시간이 해제되었습니다.','at',checked_at));
    b.data := jsonb_set(b.data,'{history}',coalesce(b.data->'history','[]') || jsonb_build_array(
      jsonb_build_object('action','deposit_expired','at',checked_at,'actor','system','note','20분 내 입금 미신고로 예약 취소 및 시간 해제')));
    update public.booking_preparations set data=b.data,version=version+1,updated_at=checked_at where appointment_id=a.id;
    update public.appointments set status='cancelled',updated_at=checked_at where id=a.id;
    expired := expired+1;
  end loop;
  return expired;
end $$;
revoke all on function public.expire_unreported_booking_deposits(text,uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.expire_unreported_booking_deposits(text,uuid,text,uuid) to service_role;

create or replace function public.prevent_overlapping_staff_appointments()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.staff_id is null or new.status not in ('pending','confirmed','in_progress','almost_done') then return new; end if;
  if new.start_at is null or new.end_at is null or new.start_at >= new.end_at then
    raise exception using errcode='22007',message='appointment time window is invalid';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(new.shop_id::text || ':' || new.staff_id::text,0));
  if TG_OP='UPDATE' and exists (select 1 from public.booking_preparations b where b.appointment_id=new.id
    and b.data#>>'{deposit,releaseIfUnreported}'='true' and b.data#>>'{deposit,status}'='pending'
    and (b.data#>>'{deposit,dueAt}')::timestamptz<=clock_timestamp()) then
    raise exception 'BOOKING_DEPOSIT_EXPIRED';
  end if;
  perform public.expire_unreported_booking_deposits(new.shop_id::text, null, new.staff_id::text, new.id);
  if exists (select 1 from public.appointments existing where existing.shop_id=new.shop_id
    and existing.staff_id=new.staff_id and existing.id<>new.id
    and existing.status in ('pending','confirmed','in_progress','almost_done')
    and tstzrange(existing.start_at,existing.end_at,'[)') && tstzrange(new.start_at,new.end_at,'[)')) then
    raise exception using errcode='23P01',message='appointment overlaps another active appointment for the same staff member';
  end if;
  return new;
end $$;

create or replace function public.snapshot_booking_policy() returns trigger
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
    if coalesce(t->>'archivedAt','') <> '' then continue; end if;
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
  due_at := least(clock_timestamp() + interval '20 minutes', new.start_at);
  insert into booking_preparations(appointment_id,shop_id,guardian_id,pet_id,data) values (
    new.id,new.shop_id,new.guardian_id,new.pet_id,
    jsonb_build_object('policy',p,'policyVersion',pv,'approvalRequired',rule='approval' and new.source='customer',
      'guardianName',(select name from guardians where id=new.guardian_id),
      'petName',(select name from pets where id=new.pet_id),'consents',c,'cancellation',null,
      'history',case when new.source='customer' then jsonb_build_array(jsonb_build_object('action','policy_acceptance','at',now(),'actor','customer','note','예약 정책 확인')) else '[]'::jsonb end,'requests','[]'::jsonb,
      'deposit',jsonb_build_object('status',case when required then 'pending' else 'not_requested' end,
        'releaseIfUnreported',required,'required',required,'amount',(p->>'depositAmount')::integer,'receivedAmount',0,'refundedAmount',0,
        'dueAt',case when required then due_at else null end,'payerName','','reportedAt',null,'confirmedAt',null,'confirmedBy',null))
  );
  return new;
end $$;

create or replace function public.save_booking_preparation(p_shop text,p_appointment uuid,p_version integer,p_data jsonb,p_status text default null,p_rule text default null,p_preferences jsonb default null)
returns integer language plpgsql security invoker set search_path = public as $$
declare b booking_preparations%rowtype; a appointments%rowtype; old_signed jsonb; next_version integer;
begin
  select * into a from appointments where id = p_appointment and shop_id = p_shop for update;
  if not found then raise exception 'BOOKING_NOT_FOUND'; end if;
  select * into b from booking_preparations where appointment_id = p_appointment and shop_id = p_shop for update;
  if not found or b.version <> p_version then raise exception 'BOOKING_VERSION_CONFLICT'; end if;
  if a.status in ('pending','confirmed') and b.data#>>'{deposit,releaseIfUnreported}'='true'
    and b.data#>>'{deposit,status}'='pending' and (b.data#>>'{deposit,dueAt}')::timestamptz<=clock_timestamp() then
    raise exception 'BOOKING_DEPOSIT_EXPIRED';
  end if;
  if p_data#>>'{deposit,status}'='pending' and p_data#>>'{deposit,releaseIfUnreported}'='true'
    and b.data#>>'{deposit,status}' in ('not_requested','cancelled') then
    if a.start_at<=clock_timestamp() then raise exception 'BOOKING_DEPOSIT_EXPIRED'; end if;
    p_data := jsonb_set(p_data,'{deposit,dueAt}',to_jsonb(least(clock_timestamp()+interval '20 minutes',a.start_at)));
  end if;
  if b.data#>>'{deposit,status}'='pending' and p_data#>>'{deposit,status}'='reported' then
    p_data := jsonb_set(p_data,'{deposit,reportedAt}',to_jsonb(clock_timestamp()));
  end if;
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
