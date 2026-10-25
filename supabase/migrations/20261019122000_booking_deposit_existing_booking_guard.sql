-- New bookings still use their normal policy snapshot. Consent-only initialization
-- of an already accepted booking must not attach today's deposit policy.
-- No data backfill, default overwrite, grant change, or scheduler activation.
create or replace function public.pm_deposit_attach() returns trigger
language plpgsql security invoker set search_path='' as $$
declare a public.appointments%rowtype; d public.booking_deposit_accounts%rowtype; decision jsonb; needed boolean; snapshot jsonb; deadline timestamptz;
begin
 if new.data->>'depositInitialization'='existing_booking' then return new; end if;
 select * into a from public.appointments where id=new.appointment_id;
 if a.created_at<(select activated_at from public.booking_deposit_activation where singleton) then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended(a.shop_id||':'||a.guardian_id::text,71));
 decision:=public.pm_deposit_decision(a.shop_id,a.guardian_id,a.appointment_date,a.id); needed:=(decision->>'required')::boolean;
 select * into d from public.booking_deposit_accounts where shop_id=a.shop_id and guardian_id=a.guardian_id and booking_date=a.appointment_date for update;
 if not needed and d.id is null then return new; end if;
 if d.id is null then
  snapshot:=new.data->'policy'; deadline:=least(clock_timestamp()+make_interval(mins=>coalesce((snapshot->>'depositHoldMinutes')::integer,20)),a.start_at);
  if deadline<=clock_timestamp() then raise exception 'BOOKING_DEPOSIT_EXPIRED'; end if;
  insert into public.booking_deposit_accounts(shop_id,guardian_id,booking_date,policy_snapshot,reason,requested_amount,due_at)
   values(a.shop_id,a.guardian_id,a.appointment_date,snapshot,decision->>'reason',(snapshot->>'depositAmount')::integer,deadline) returning * into d;
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,a.id,'requested','system','created',decision);
  insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'request',d.id||':request:0');
 elsif d.state='cancelled' and d.received_total-d.refunded_total-d.used_total-d.forfeited_total>0 then
  update public.booking_deposit_accounts set state='confirmed',refund_due=0,cancellation_assessed_at=null,version=version+1 where id=d.id;
 end if;
 if d.state='cancelled' and needed and d.received_total-d.refunded_total-d.used_total-d.forfeited_total=0 then
  update public.booking_deposit_accounts set state='pending',report_valid=false,reported_at=null,review_reminded_at=null,cancellation_assessed_at=null,
   retry_count=retry_count+1,retry_due_at=least(a.start_at,clock_timestamp()+make_interval(mins=>coalesce((d.policy_snapshot->>'depositHoldMinutes')::integer,20))),version=version+1 where id=d.id;
  insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'request',d.id||':rebook:'||a.id);
 end if;
 insert into public.booking_deposit_links(appointment_id,account_id,requires_deposit) values(a.id,d.id,needed);
 insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,a.id,'linked','system','linked:'||a.id,jsonb_build_object('reason',decision->>'reason'));
 update public.booking_deposit_accounts set due_at=least(due_at,a.start_at),refund_due=0 where id=d.id and state<>'cancelled';
 perform public.pm_deposit_rebalance(d.id);
 if needed and (select state in ('confirmed','waived') from public.booking_deposit_accounts where id=d.id) then
  update public.appointments set status='confirmed' where id=a.id and status='pending' and not coalesce((new.data->>'approvalRequired')::boolean,false);
 end if;
 return new;
end $$;
