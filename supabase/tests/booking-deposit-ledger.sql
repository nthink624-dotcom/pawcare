-- Only synthetic IDs below are mutated in the isolated local database.
create schema ledger_test;
create function ledger_test.book(g uuid,days integer,at_time text default '10:00',booking_source text default 'owner') returns uuid language plpgsql as $$
declare a uuid; start_time timestamptz;
begin
 start_time:=((current_date+days)::text||' '||at_time||'+09')::timestamptz;
 insert into public.appointments(shop_id,guardian_id,pet_id,service_id,staff_id,appointment_date,appointment_time,status,source,start_at,end_at,original_service_price,final_service_price,discount_snapshot)
 values('ledger-local',g,(select id from public.pets where guardian_id=g limit 1),'ledger-local-service','ledger-local-staff',current_date+days,at_time::time,'confirmed',booking_source,start_time,start_time+interval '1 hour',25000,25000,jsonb_build_object('bookingPolicyVersion',(select version from public.shop_booking_policies where shop_id='ledger-local'))) returning id into a;
 return a;
end $$;
insert into public.shops(id,name,phone,address) values('ledger-local','개발 검증 매장','01000000000','개발 전용');
update public.shops set business_hours=(select jsonb_object_agg(n::text,'{"open":"00:00","close":"23:59","enabled":true}'::jsonb) from generate_series(0,6)n),regular_closed_days='{}',booking_available_start_time='00:00',booking_available_end_time='23:59' where id='ledger-local';
insert into public.guardians(id,shop_id,name,phone) values('00000000-1111-4000-8000-000000000001','ledger-local','첫 보호자','01000000001'),('00000000-1111-4000-8000-000000000002','ledger-local','다음 보호자','01000000002');
insert into public.pets(id,shop_id,guardian_id,name,breed) select gen_random_uuid(),'ledger-local',id,'검증 반려견','말티즈' from public.guardians where shop_id='ledger-local';
insert into public.services(id,shop_id,name,price,duration_minutes,is_active) values('ledger-local-service','ledger-local','목욕',25000,60,true);
insert into public.staff_members(id,shop_id,name,role,default_days,start_time,end_time)
 select 'ledger-local-staff','ledger-local','검증 담당자',role,array['sun','mon','tue','wed','thu','fri','sat'],'00:00'::time,'23:59'::time from public.staff_members limit 1;
insert into public.shop_booking_policies(shop_id,policy,version) values('ledger-local','{"depositMode":"required","depositAudience":"all","depositBase":"all","depositAmount":20000,"depositDueHours":24,"depositHoldMinutes":35,"bankName":"개발은행","bankAccount":"0000000000","bankHolder":"개발","cancellationCutoffHours":2,"cancellationNotice":"검증용 전액 환불","firstNoshowRule":"normal","repeatNoshowRule":"normal","consentBeforeStart":false,"templates":[],"depositRefundRules":[{"hoursBefore":0,"percent":100}]}',1);
do $$
declare g uuid:='00000000-1111-4000-8000-000000000001'; h uuid:='00000000-1111-4000-8000-000000000002'; a uuid; b uuid; c uuid; d uuid; snap timestamptz; count_accounts integer; v jsonb; amount integer;
begin
 a:=ledger_test.book(g,3); b:=ledger_test.book(g,3,'12:00');
 select account_id into d from public.booking_deposit_links where appointment_id=a;
 assert (select account_id=d from public.booking_deposit_links where appointment_id=b),'same day one account';
 assert (select count(*)=1 from public.booking_deposit_accounts where shop_id='ledger-local'),'one request';
 assert (select status='pending' from public.appointments where id=a),'pending and slot held';
 perform public.pm_deposit_act('ledger-local',a,'report','test-report-0001','customer',null,'입금자');
 assert (select received_total=0 and state='reported' from public.booking_deposit_accounts where id=d),'report is not money';
 perform public.pm_deposit_act('ledger-local',a,'confirm','test-confirm-0001','owner',20000,'입금자');
 perform public.pm_deposit_act('ledger-local',a,'confirm','test-confirm-0001','owner',20000,'입금자');
 assert (select received_total=20000 from public.booking_deposit_accounts where id=d),'idempotent replacement total';
 assert (select count(*)=2 from public.appointments where id in (a,b) and status='confirmed'),'both same-day bookings confirmed';
 assert (select sum(allocated_amount)=20000 from public.booking_deposit_links where account_id=d),'no double allocation';
 update public.appointments set status='cancelled' where id=a;
 assert (select refund_due=0 from public.booking_deposit_accounts where id=d),'partial cancellation keeps funds';
 assert (select allocated_amount=20000 from public.booking_deposit_links where appointment_id=b),'automatic reassignment';
 update public.appointments set status='completed' where id=b;
 assert (select used_total=20000 and refund_due=0 from public.booking_deposit_accounts where id=d),'deduct once at completion';
 begin perform public.pm_deposit_act('ledger-local',b,'refund','test-refund-invalid','owner',1,null,'검증');raise exception 'overspent refund accepted';exception when raise_exception then if sqlerrm not like 'DEPOSIT_REFUND_EXCEEDS_AVAILABLE%' then raise; end if;end;
 -- New first-visit protection is tied to actual confirmed cash, not report status.
 update public.shop_booking_policies set policy=policy||'{"depositBase":"first_visit"}' where shop_id='ledger-local';
 c:=ledger_test.book(h,4); perform public.pm_deposit_act('ledger-local',c,'report','test-report-0002','customer',null,'입금자');
 assert public.pm_deposit_required('ledger-local',h,current_date+5),'report alone not first-visit fulfillment';
 perform public.pm_deposit_act('ledger-local',c,'confirm','test-confirm-0002','owner',20000,'입금자');
 assert not public.pm_deposit_required('ledger-local',h,current_date+5),'verified first deposit exempts later dates before grooming';
 update public.guardians set deposit_exception='always' where id=h;
 assert public.pm_deposit_required('ledger-local',h,current_date+5),'always separate';
 update public.guardians set deposit_exception='exempt' where id=h;
 assert not public.pm_deposit_required('ledger-local',h,current_date+5),'exempt final priority';
 update public.guardians set deposit_exception='always' where id=h;
 a:=ledger_test.book(h,6);select due_at into snap from public.booking_deposit_accounts where id=(select account_id from public.booking_deposit_links where appointment_id=a);
 perform public.pm_deposit_move_booking('ledger-local',a,jsonb_build_object('appointment_date',(current_date+7)::text,'appointment_time','11:00','start_at',((current_date+7)::text||' 11:00+09')::timestamptz,'end_at',((current_date+7)::text||' 12:00+09')::timestamptz),true,'owner');
 assert (select due_at=snap from public.booking_deposit_accounts where id=(select account_id from public.booking_deposit_links where appointment_id=a)),'move never extends deadline';
 -- Full cancellation applies once and late receipt never restores reservation.
 update public.appointments set status='cancelled' where id=a;
 perform public.pm_deposit_act('ledger-local',a,'confirm','test-late-confirm','owner',20000,'입금자');
 assert (select status='cancelled' from public.appointments where id=a),'late payment no resurrection';
 assert (select refund_due=20000 from public.booking_deposit_accounts where id=(select account_id from public.booking_deposit_links where appointment_id=a)),'late payment full refund';
 perform public.pm_deposit_act('ledger-local',a,'refund','test-refund-0001','owner',20000,null,'직접 반환 확인');
 perform public.pm_deposit_act('ledger-local',a,'refund','test-refund-0001','owner',20000,null,'직접 반환 확인');
 assert (select refunded_total=20000 from public.booking_deposit_accounts where id=(select account_id from public.booking_deposit_links where appointment_id=a)),'refund retry not duplicated';
end $$;
select 'LEDGER_LOCAL_FINANCIAL_TARGETING_TESTS_PASSED';
do $$
declare g uuid:='00000000-1111-4000-8000-000000000002'; a uuid; b uuid; d uuid; first_report timestamptz; v jsonb;
begin
 update public.guardians set deposit_exception='always' where id=g;
 a:=ledger_test.book(g,11);select account_id into d from public.booking_deposit_links where appointment_id=a;
 update public.booking_deposit_accounts set due_at=clock_timestamp()-interval '1 second' where id=d;
 perform public.pm_deposit_tick('ledger-local');
 assert (select status='cancelled' from public.appointments where id=a),'clock expires unreported';
 b:=ledger_test.book(g,12);
 perform public.pm_deposit_act('ledger-local',b,'report','local-clock-report','customer',null,'신고자');
 select account_id into d from public.booking_deposit_links where appointment_id=b;
 select reported_at into first_report from public.booking_deposit_accounts where id=d;
 -- Clock fixture prepared through the same atomic move RPC; no triggers/constraints disabled.
 perform public.pm_deposit_move_booking('ledger-local',b,jsonb_build_object('appointment_date',(clock_timestamp() at time zone 'Asia/Seoul')::date,'appointment_time',date_trunc('minute',(clock_timestamp()-interval '1 minute') at time zone 'Asia/Seoul')::time,'start_at',date_trunc('minute',clock_timestamp())-interval '1 minute','end_at',date_trunc('minute',clock_timestamp())+interval '59 minutes'),true,'owner');
 select account_id into d from public.booking_deposit_links where appointment_id=b;
 perform public.pm_deposit_tick('ledger-local');
 assert (select status='confirmed' from public.appointments where id=b),'clock auto-confirms valid report at start';
 v:=public.pm_deposit_view('ledger-local',b);
 assert (v->>'unverified')::boolean and (v->>'receivedTotal')::integer=0 and (v->>'allocatedAmount')::integer=0,'unverified report no discount or refund money';
 perform public.pm_deposit_act('ledger-local',b,'report','local-name-correct','customer',null,'수정된 신고자');
 assert (select reported_at=first_report from public.booking_deposit_accounts where id=d),'payer edit does not extend first report';
 update public.booking_deposit_accounts set reported_at=clock_timestamp()-interval '1 hour' where id=d;
 perform public.pm_deposit_tick('ledger-local');
 assert (select review_reminded_at is not null from public.booking_deposit_accounts where id=d),'owner reminder without cancelling';
 perform public.pm_deposit_act('ledger-local',b,'confirm','local-clock-confirm','owner',20000,'입금자');
 update public.appointments set original_service_price=10000,final_service_price=10000,status='completed' where id=b;
 assert (select used_total=10000 and refund_due=10000 from public.booking_deposit_accounts where id=d),'excess refund after smaller grooming fee';
 perform public.pm_deposit_act('ledger-local',b,'correct','local-post-completion-cash','owner',30000,'입금자','추가 입금 총액 확인');
 assert (select used_total=10000 and refund_due=20000 from public.booking_deposit_accounts where id=d),'closed settlement cannot consume additional cash again';
 assert not has_function_privilege('authenticated','public.pm_deposit_act(text,uuid,text,text,text,integer,text,text,integer)','execute'),'browser RPC denied';
 assert public.pm_deposit_view('other-shop',b) is null,'view tenant filter';
end $$;
select 'LEDGER_CLOCK_RECEIPT_PERMISSION_TESTS_PASSED';
do $$
declare g uuid:='00000000-1111-4000-8000-000000000002'; a uuid; b uuid; c uuid; d uuid; target uuid;
begin
 a:=ledger_test.book(g,21); perform public.pm_deposit_act('ledger-local',a,'confirm','carry-bulk-total-01','owner',40000,'총액 입금자');
 select account_id into d from public.booking_deposit_links where appointment_id=a;
 b:=ledger_test.book(g,22);
 perform public.pm_deposit_carry('ledger-local',b,d,20000,'carry-bulk-0001','owner');
 perform public.pm_deposit_carry('ledger-local',b,d,20000,'carry-bulk-0001','owner');
 assert (select received_total=20000 from public.booking_deposit_accounts where id=d),'bulk total retained once';
 perform public.pm_deposit_act('ledger-local',a,'correct','carry-total-correct-01','owner',40000,'총액 입금자','승계 후 같은 실제 총액 재확인');
 assert (select received_total=20000 from public.booking_deposit_accounts where id=d),'re-entering gross bank total after carry never adds money again';
 select account_id into target from public.booking_deposit_links where appointment_id=b;
 assert (select received_total=20000 from public.booking_deposit_accounts where id=target),'carry idempotent';
 assert (select status='confirmed' from public.appointments where id=b),'carry confirms existing target';
 begin perform public.pm_deposit_carry('ledger-local',b,d,1,'carry-invalid-001','owner');raise exception 'spent carry accepted';exception when raise_exception then if sqlerrm<>'DEPOSIT_MONEY_ALREADY_USED' then raise;end if;end;
 update public.appointments set status='cancelled' where id=a;
 c:=ledger_test.book(g,23); perform public.pm_deposit_carry('ledger-local',c,d,20000,'carry-rebook-001','owner');
 assert (select refund_due=0 and received_total=0 from public.booking_deposit_accounts where id=d),'unrefunded cancelled money carried by owner';
 assert (select count(*)=2 from public.booking_deposit_events where request_key in ('carry-out:carry-rebook-001','carry-in:carry-rebook-001')),'carry audit pair';
 begin update public.booking_deposit_events set actor='tampered' where account_id=d;raise exception 'audit edit accepted';exception when raise_exception then if sqlerrm<>'DEPOSIT_AUDIT_IMMUTABLE' then raise;end if;end;
 assert exists(select 1 from public.booking_deposit_outbox where appointment_id=a and purpose='cancelled'),'manual cancellation queued';
 update public.appointments set status='cancelled' where id=b;
 perform public.pm_deposit_act('ledger-local',b,'refund','same-day-refund-01','owner',20000,null,'직접 전액 반환');
 b:=ledger_test.book(g,22,'13:00');
 assert (select state='pending' and retry_due_at>clock_timestamp() from public.booking_deposit_accounts where id=target),'refunded same-day rebook fresh request';
 perform public.pm_deposit_act('ledger-local',b,'report','same-day-report-01','customer',null,'새 입금자');
 assert (select received_total=refunded_total from public.booking_deposit_accounts where id=target),'rebook report still no cash';
end $$;
select 'LEDGER_CARRY_AUDIT_REBOOK_TESTS_PASSED';
do $$
declare g uuid:='00000000-1111-4000-8000-000000000002'; a uuid; d uuid;
begin
 a:=ledger_test.book(g,27);perform public.pm_deposit_act('ledger-local',a,'confirm','move-no-carry-01','owner',20000,'실제 입금자');
 select account_id into d from public.booking_deposit_links where appointment_id=a;
 perform public.pm_deposit_move_booking('ledger-local',a,jsonb_build_object('appointment_date',(current_date+28)::text,'appointment_time','11:00','start_at',((current_date+28)::text||' 11:00+09')::timestamptz,'end_at',((current_date+28)::text||' 12:00+09')::timestamptz),false,'owner');
 assert (select status='pending' from public.appointments where id=a),'confirmed booking without cash carry must wait for new payment';
 perform public.pm_deposit_refund_source('ledger-local',a,d,20000,'refund-old-date-01','owner','직접 전액 반환');
 perform public.pm_deposit_refund_source('ledger-local',a,d,20000,'refund-old-date-01','owner','직접 전액 반환');
 assert (select refunded_total=20000 and refund_due=0 from public.booking_deposit_accounts where id=d),'orphaned source can refund exactly once in same detail';
end $$;
select 'LEDGER_ASSIGNED_STAFF_REENTRANT_CLOCK_AND_SOURCE_REFUND_PASSED';
do $$
declare g uuid:='00000000-1111-4000-8000-000000000002'; a uuid;
begin
 update public.guardians set deposit_exception='exempt' where id=g;
 insert into public.guardian_booking_conditions(shop_id,guardian_id,rule,reason) values('ledger-local',g,'blocked','검증 전용') on conflict(shop_id,guardian_id) do update set rule='blocked';
 begin a:=ledger_test.book(g,31,'10:00','customer');raise exception 'BLOCKED_REQUEST_ACCEPTED';exception when raise_exception then if sqlerrm<>'BOOKING_ONLINE_RESTRICTED' then raise;end if;end;
 update public.guardian_booking_conditions set rule='approval' where guardian_id=g and shop_id='ledger-local';
 a:=ledger_test.book(g,32,'10:00','customer');
 assert (select status='pending' from public.appointments where id=a),'deposit exemption does not bypass independent approval';
 assert (select (data->>'approvalRequired')::boolean and not (data#>>'{deposit,required}')::boolean from public.booking_preparations where appointment_id=a),'exempt and approval are separate contracts';
end $$;
select 'LEDGER_EXEMPTION_PRESERVES_BLOCK_AND_APPROVAL_PASSED';
