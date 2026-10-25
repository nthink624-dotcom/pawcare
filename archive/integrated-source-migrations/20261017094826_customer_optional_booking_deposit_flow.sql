-- Customer-selected deposits are captured in the trusted server-built appointment
-- discount snapshot, then applied atomically by the appointment policy triggers.
create or replace function public.prepare_booking_policy() returns trigger
language plpgsql security invoker set search_path = public as $$
declare
  p jsonb; pv integer; n integer; rule text; applies boolean; required boolean;
  customer_deposit_choice boolean;
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
  select c.rule into rule from guardian_booking_conditions c where c.shop_id = new.shop_id and c.guardian_id = new.guardian_id;
  rule := coalesce(rule, case when n >= 2 then p->>'repeatNoshowRule' when n = 1 then p->>'firstNoshowRule' else 'normal' end);
  if new.source = 'customer' and rule = 'blocked' then raise exception 'BOOKING_ONLINE_RESTRICTED'; end if;

  applies := p->>'depositAudience' = 'all'
    or (p->>'depositAudience' = 'noshow' and n > 0)
    or (p->>'depositAudience' = 'new' and not exists (
      select 1 from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status in ('completed','in_progress','almost_done')
    ));
  customer_deposit_choice := new.source = 'customer'
    and coalesce((new.discount_snapshot->>'depositChoice')::boolean, false);

  if customer_deposit_choice and rule <> 'deposit'
    and (p->>'depositMode' = 'off' or not applies) then
    raise exception 'BOOKING_DEPOSIT_NOT_AVAILABLE';
  end if;

  required := rule = 'deposit'
    or (p->>'depositMode' = 'required' and applies)
    or (p->>'depositMode' = 'optional' and applies and customer_deposit_choice);
  if required and (coalesce(p->>'bankAccount','') = '' or coalesce((p->>'depositAmount')::integer,0) <= 0) then
    raise exception 'BOOKING_DEPOSIT_NOT_CONFIGURED';
  end if;
  if required or (new.source = 'customer' and rule = 'approval') then new.status := 'pending'; end if;
  return new;
end $$;

create or replace function public.snapshot_booking_policy() returns trigger
language plpgsql security invoker set search_path = public as $$
declare p jsonb; pv integer; c jsonb := '[]'; t jsonb; signed jsonb; n integer; rule text; required boolean; applies boolean; due_at timestamptz;
  customer_deposit_choice boolean;
begin
  select policy,version into p,pv from shop_booking_policies where shop_id = new.shop_id;
  if p is null then return new; end if;
  select count(*) into n from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status = 'noshow';
  select b.rule into rule from guardian_booking_conditions b where b.shop_id = new.shop_id and b.guardian_id = new.guardian_id;
  rule := coalesce(rule, case when n >= 2 then p->>'repeatNoshowRule' when n = 1 then p->>'firstNoshowRule' else 'normal' end);
  applies := p->>'depositAudience' = 'all'
    or (p->>'depositAudience' = 'noshow' and n > 0)
    or (p->>'depositAudience' = 'new' and not exists (
      select 1 from appointments where shop_id = new.shop_id and guardian_id = new.guardian_id and status in ('completed','in_progress','almost_done')
    ));
  customer_deposit_choice := new.source = 'customer'
    and coalesce((new.discount_snapshot->>'depositChoice')::boolean, false);
  required := rule = 'deposit'
    or (p->>'depositMode' = 'required' and applies)
    or (p->>'depositMode' = 'optional' and applies and customer_deposit_choice);

  for t in select value from jsonb_array_elements(coalesce(p->'templates','[]')) loop
    if coalesce(t->>'archivedAt','') <> '' then continue; end if;
    if not coalesce((t->>'enabled')::boolean,false) then continue; end if;
    if t->>'audience' = 'manual' then continue; end if;
    if t->>'audience' = 'new' and exists (
      select 1 from appointments where shop_id=new.shop_id and guardian_id=new.guardian_id and status in ('completed','in_progress','almost_done')
    ) then continue; end if;
    signed := null;
    if t->>'scope' = 'pet' then
      select item into signed from booking_preparations b, lateral jsonb_array_elements(b.data->'consents') item
      where b.shop_id = new.shop_id and b.guardian_id = new.guardian_id and b.pet_id = new.pet_id
        and item->>'id' = t->>'id' and item->>'version' = t->>'version' and item->>'status' = 'signed'
      order by b.updated_at desc limit 1;
    end if;
    c := c || jsonb_build_array(coalesce(signed, t || '{"status":"pending"}'::jsonb));
  end loop;

  due_at := least(clock_timestamp() + make_interval(mins => coalesce((p->>'depositHoldMinutes')::integer,20)), new.start_at);
  insert into booking_preparations(appointment_id,shop_id,guardian_id,pet_id,data) values (
    new.id,new.shop_id,new.guardian_id,new.pet_id,
    jsonb_build_object('policy',p,'policyVersion',pv,'approvalRequired',rule='approval' and new.source='customer',
      'guardianName',(select name from guardians where id=new.guardian_id),
      'petName',(select name from pets where id=new.pet_id),'consents',c,'cancellation',null,
      'history',case when new.source='customer' then jsonb_build_array(jsonb_build_object('action','policy_acceptance','at',clock_timestamp(),'actor','customer','note','예약 정책 확인')) else '[]'::jsonb end,'requests','[]'::jsonb,
      'deposit',jsonb_build_object('status',case when required then 'pending' else 'not_requested' end,
        'releaseIfUnreported',required,'required',required,'amount',(p->>'depositAmount')::integer,'receivedAmount',0,'refundedAmount',0,
        'dueAt',case when required then due_at else null end,'payerName','','reportedAt',null,'confirmedAt',null,'confirmedBy',null))
  );
  return new;
end $$;

-- A protected server-side RPC lets the scheduled task release expired holds
-- without exposing shop-wide expiry scans to anon/authenticated clients.
create or replace function public.expire_all_unreported_booking_deposits()
returns integer language plpgsql security invoker set search_path = '' as $$
declare shop record; shop_expired integer; expired integer := 0;
begin
  for shop in
    select distinct bp.shop_id
    from public.booking_preparations bp
    join public.appointments a on a.id = bp.appointment_id and a.shop_id = bp.shop_id
    where a.status in ('pending','confirmed')
      and bp.data#>>'{deposit,releaseIfUnreported}'='true'
      and bp.data#>>'{deposit,status}'='pending'
      and (bp.data#>>'{deposit,dueAt}')::timestamptz <= clock_timestamp()
  loop
    select public.expire_unreported_booking_deposits(shop.shop_id, null, null, null) into shop_expired;
    expired := expired + coalesce(shop_expired,0);
  end loop;
  return expired;
end $$;

revoke all on function public.expire_all_unreported_booking_deposits() from public,anon,authenticated;
grant execute on function public.expire_all_unreported_booking_deposits() to service_role;
