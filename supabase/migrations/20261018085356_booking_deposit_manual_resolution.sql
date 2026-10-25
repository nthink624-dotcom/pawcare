-- Keep overlap-trigger expiry reentrant; retain its original staff/capacity checks.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $patch$
declare src text;
begin
 select pg_get_functiondef('public.pm_deposit_tick(text,timestamp with time zone)'::regprocedure) into src;
 if position('-- Only ledger-linked new bookings participate.' in src)=0 then raise exception 'UNEXPECTED_TICK_SOURCE'; end if;
 src:=replace(src,'-- Only ledger-linked new bookings participate.',
 'if current_setting(''petmanager.deposit_tick'',true)=''on'' then return jsonb_build_object(''expired'',0,''autoConfirmed'',0,''reminders'',0); end if;
 perform set_config(''petmanager.deposit_tick'',''on'',true);
 -- Only ledger-linked new bookings participate.');
 src:=replace(src,'return jsonb_build_object(''expired'',expired','perform set_config(''petmanager.deposit_tick'',''off'',true);
 return jsonb_build_object(''expired'',expired');execute src;
 select pg_get_functiondef('public.pm_deposit_move_booking(text,uuid,jsonb,boolean,text)'::regprocedure) into src;
 src:=replace(src,'if not p_transfer then insert into public.booking_deposit_outbox',
 'if not p_transfer and linked.requires_deposit and target.state not in (''confirmed'',''waived'') then v.status:=''pending''; end if;
  if not p_transfer then insert into public.booking_deposit_outbox');execute src;
 select pg_get_functiondef('public.pm_deposit_decision(text,uuid,date,uuid)'::regprocedure) into src;
 src:=replace(src,'current_date-coalesce','(clock_timestamp() at time zone ''Asia/Seoul'')::date-coalesce');execute src;
 select pg_get_functiondef('public.pm_deposit_available(text,uuid)'::regprocedure) into src;
 src:=replace(src,'and target.status in (''pending'',''confirmed'')','');execute src;
end $patch$;

-- Date-change money retained at the source remains refundable from the same booking detail.
create function public.pm_deposit_refund_source(p_shop text,p_appointment uuid,p_source uuid,p_amount integer,p_key text,p_actor text,p_note text) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.appointments%rowtype; d public.booking_deposit_accounts%rowtype;
begin
 select * into a from public.appointments where id=p_appointment and shop_id=p_shop;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop||':'||a.guardian_id::text,71));
 select * into d from public.booking_deposit_accounts where id=p_source and shop_id=p_shop and guardian_id=a.guardian_id for update;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 if coalesce(length(p_key),0) not between 8 and 160 or coalesce(length(trim(p_note)),0)=0 then raise exception 'DEPOSIT_REASON_REQUIRED'; end if;
 if exists(select 1 from public.booking_deposit_events where account_id=d.id and request_key='source-refund:'||p_key) then return; end if;
 if p_amount is null or p_amount<=0 or p_amount>d.received_total-d.refunded_total-d.used_total-d.forfeited_total then raise exception 'DEPOSIT_REFUND_EXCEEDS_AVAILABLE'; end if;
 update public.booking_deposit_accounts set refunded_total=refunded_total+p_amount,refund_due=greatest(0,refund_due-p_amount),version=version+1,updated_at=clock_timestamp() where id=d.id;
 insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details)
 values(d.id,a.id,'refund',p_actor,'source-refund:'||p_key,jsonb_build_object('previousRefund',d.refunded_total,'refunded',d.refunded_total+p_amount,'note',left(p_note,2000),'sourceDate',d.booking_date));
 perform public.pm_deposit_rebalance(d.id);
 insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'refunded',d.id||':source-refund:'||p_key);
end $$;
revoke all on function public.pm_deposit_refund_source(text,uuid,uuid,integer,text,text,text) from public,anon,authenticated;
grant execute on function public.pm_deposit_refund_source(text,uuid,uuid,integer,text,text,text) to service_role;
commit;
