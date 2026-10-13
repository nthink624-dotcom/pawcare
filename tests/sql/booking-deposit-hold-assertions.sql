insert into public.shops values ('hold-fixture'),('other-fixture');
insert into public.guardians(id,shop_id,name) values ('00000000-0000-4000-8000-000000000001','hold-fixture','fixture');
insert into public.pets(id,shop_id,guardian_id,name) values ('00000000-0000-4000-8000-000000000002','hold-fixture','00000000-0000-4000-8000-000000000001','fixture');
insert into public.shop_booking_policies(shop_id,policy) values ('hold-fixture','{"depositMode":"required","depositAudience":"all","depositAmount":20000,"depositDueHours":24,"bankAccount":"fixture","firstNoshowRule":"normal","repeatNoshowRule":"normal","templates":[]}');
create function public.fixture_booking(st text) returns uuid language plpgsql as $$
declare a uuid;
begin
  insert into public.appointments(shop_id,guardian_id,pet_id,staff_id,status,start_at,end_at)
  values ('hold-fixture','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002',st,'confirmed',now()+interval '1 day',now()+interval '1 day 1 hour') returning id into a;
  return a;
end $$;
do $$
declare a uuid; replacement uuid; v integer; d jsonb; failed boolean; due timestamptz;
begin
  a:=public.fixture_booking('unreported');
  select data,version into d,v from public.booking_preparations where appointment_id=a;
  due:=(d#>>'{deposit,dueAt}')::timestamptz;
  if due<clock_timestamp()+interval '19 minutes 55 seconds' or due>clock_timestamp()+interval '20 minutes'
    or d#>>'{deposit,releaseIfUnreported}'<>'true' then raise exception 'new 20 minute snapshot missing'; end if;
  failed:=false;
  begin perform public.fixture_booking('unreported'); exception when exclusion_violation then failed:=true; end;
  if not failed then raise exception 'unexpired reservation did not hold its staff'; end if;
  update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  update public.booking_preparations set data=jsonb_set(data,'{consents}','[{"id":"signed-fixture","status":"signed","signature":[[{"x":0.1,"y":0.2}]]}]') where appointment_id=a;
  -- The INSERT path must release an expired booking even without an availability read.
  replacement:=public.fixture_booking('unreported');
  if (select status from public.appointments where id=a)<>'cancelled' then raise exception 'expired booking not cancelled'; end if;
  if (select data#>>'{cancellation,kind}' from public.booking_preparations where appointment_id=a)<>'deposit_expired' then raise exception 'expiry audit kind missing'; end if;
  if (select data#>>'{consents,0,status}' from public.booking_preparations where appointment_id=a)<>'signed' then raise exception 'signed consent erased by expiry'; end if;
  if public.expire_unreported_booking_deposits('hold-fixture',a,null)<>0 then raise exception 'expiry not idempotent'; end if;

  a:=public.fixture_booking('reported');
  select data,version into d,v from public.booking_preparations where appointment_id=a;
  d:=jsonb_set(jsonb_set(d,'{deposit,status}','"reported"'),'{deposit,payerName}','"fixture"');
  perform public.save_booking_preparation('hold-fixture',a,v,d);
  update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  if public.expire_unreported_booking_deposits('hold-fixture',a,null)<>0 then raise exception 'reported deposit expired'; end if;
  failed:=false;
  begin perform public.fixture_booking('reported'); exception when exclusion_violation then failed:=true; end;
  if not failed then raise exception 'reported booking did not keep its slot'; end if;
  select data,version into d,v from public.booking_preparations where appointment_id=a;
  d:=jsonb_set(jsonb_set(d,'{deposit,status}','"confirmed"'),'{deposit,receivedAmount}','20000');
  perform public.save_booking_preparation('hold-fixture',a,v,d,'confirmed');
  if (select status from public.appointments where id=a)<>'confirmed' then raise exception 'owner confirmation after report failed'; end if;

  a:=public.fixture_booking('late-report');
  update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  select data,version into d,v from public.booking_preparations where appointment_id=a;
  failed:=false;
  begin perform public.save_booking_preparation('hold-fixture',a,v,jsonb_set(d,'{deposit,status}','"reported"'));
  exception when raise_exception then if SQLERRM not like '%BOOKING_DEPOSIT_EXPIRED%' then raise; end if; failed:=true; end;
  if not failed then raise exception 'late report accepted'; end if;
  if public.expire_unreported_booking_deposits('other-fixture',a,null)<>0 then raise exception 'cross shop expiry'; end if;

  -- A manually requested optional deposit on a confirmed reservation follows the same deadline.
  a:=public.fixture_booking('optional');
  update public.booking_preparations set data=jsonb_set(jsonb_set(data,'{deposit,status}','"not_requested"'),'{deposit,required}','false') where appointment_id=a;
  update public.appointments set status='confirmed' where id=a;
  select data,version into d,v from public.booking_preparations where appointment_id=a;
  d:=jsonb_set(jsonb_set(d,'{deposit,status}','"pending"'),'{deposit,dueAt}',to_jsonb(clock_timestamp()+interval '1 day'));
  perform public.save_booking_preparation('hold-fixture',a,v,d);
  if (select (data#>>'{deposit,dueAt}')::timestamptz from public.booking_preparations where appointment_id=a)>clock_timestamp()+interval '20 minutes' then raise exception 'request deadline not enforced in DB'; end if;
  update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  if public.expire_unreported_booking_deposits('hold-fixture',a,null)<>1 then raise exception 'optional deposit did not release slot'; end if;

  a:=public.fixture_booking('legacy');
  update public.booking_preparations set data=jsonb_set(data#-'{deposit,releaseIfUnreported}','{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  if public.expire_unreported_booking_deposits('hold-fixture',a,null)<>0 then raise exception 'historical booking changed'; end if;
  failed:=false;
  begin perform public.fixture_booking('legacy'); exception when exclusion_violation then failed:=true; end;
  if not failed then raise exception 'historical slot released'; end if;

  a:=public.fixture_booking('expired-update');
  update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()-interval '1 second')) where appointment_id=a;
  failed:=false;
  begin update public.appointments set start_at=start_at+interval '2 hours',end_at=end_at+interval '2 hours' where id=a;
  exception when raise_exception then if SQLERRM not like '%BOOKING_DEPOSIT_EXPIRED%' then raise; end if; failed:=true; end;
  if not failed then raise exception 'expired reservation time change accepted'; end if;
  if has_function_privilege('anon','public.expire_unreported_booking_deposits(text,uuid,text,uuid)','execute')
    or has_function_privilege('authenticated','public.expire_unreported_booking_deposits(text,uuid,text,uuid)','execute')
    or not has_function_privilege('service_role','public.expire_unreported_booking_deposits(text,uuid,text,uuid)','execute') then raise exception 'server-only RPC grants failed'; end if;
end $$;
select 'DEPOSIT_HOLD_SQL_ASSERTIONS_PASS';
