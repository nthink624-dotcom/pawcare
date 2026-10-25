-- Forward hardening of the verified v1 ledger; never backfills historical reservations.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';

create function public.pm_deposit_available(p_shop text,p_appointment uuid) returns jsonb
language sql security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'date',d.booking_date,'available',d.available) order by d.booking_date),'[]') from (
 select d.id,d.booking_date,least(d.received_total-d.refunded_total-d.used_total-d.forfeited_total,
   case when exists(select 1 from public.booking_deposit_links l join public.appointments a on a.id=l.appointment_id
    where l.account_id=d.id and l.requires_deposit and a.status not in ('cancelled','rejected','noshow','completed'))
    then greatest(0,d.received_total-d.refunded_total-d.requested_amount) else d.received_total end) as available
 from public.booking_deposit_accounts d join public.appointments target on target.shop_id=d.shop_id and target.guardian_id=d.guardian_id
 where target.id=p_appointment and target.shop_id=p_shop and target.status in ('pending','confirmed') and d.booking_date<>target.appointment_date
 ) d where d.available>0
$$;

create function public.pm_deposit_carry(p_shop text,p_destination uuid,p_source uuid,p_amount integer,p_key text,p_actor text) returns void
language plpgsql security invoker set search_path='' as $$
declare a public.appointments%rowtype; source public.booking_deposit_accounts%rowtype; target public.booking_deposit_accounts%rowtype; available integer; linked record;
begin
 select * into a from public.appointments where id=p_destination and shop_id=p_shop;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop||':'||a.guardian_id::text,71));
 if p_amount is null or p_amount<=0 or p_amount>10000000 or coalesce(length(p_key),0) not between 8 and 160 then raise exception 'DEPOSIT_INVALID_CARRY'; end if;
 perform 1 from public.booking_deposit_accounts where shop_id=p_shop and guardian_id=a.guardian_id order by id for update;
 select * into source from public.booking_deposit_accounts where id=p_source and shop_id=p_shop and guardian_id=a.guardian_id;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 if exists(select 1 from public.booking_deposit_events where account_id=source.id and request_key='carry-out:'||p_key) then return; end if;
 if a.status not in ('pending','confirmed') or source.booking_date=a.appointment_date then raise exception 'DEPOSIT_INVALID_CARRY'; end if;
 select (value->>'available')::integer into available from jsonb_array_elements(public.pm_deposit_available(p_shop,a.id)) where value->>'id'=source.id::text;
 if available is null or available<p_amount then raise exception 'DEPOSIT_MONEY_ALREADY_USED'; end if;
 select * into target from public.booking_deposit_accounts where shop_id=p_shop and guardian_id=a.guardian_id and booking_date=a.appointment_date;
 if target.id is null then
  insert into public.booking_deposit_accounts(shop_id,guardian_id,booking_date,policy_snapshot,reason,requested_amount,due_at)
   values(p_shop,a.guardian_id,a.appointment_date,source.policy_snapshot,'owner_carry',source.requested_amount,least(source.due_at,a.start_at)) returning * into target;
 end if;
 insert into public.booking_deposit_links(appointment_id,account_id,requires_deposit) values(a.id,target.id,false) on conflict do nothing;
 if not exists(select 1 from public.booking_deposit_links where appointment_id=a.id and account_id=target.id) then raise exception 'DEPOSIT_TRANSFER_REVIEW_REQUIRED'; end if;
 update public.booking_deposit_accounts set received_total=received_total-p_amount,refund_due=greatest(0,refund_due-p_amount),version=version+1,updated_at=clock_timestamp() where id=source.id;
 update public.booking_deposit_accounts set received_total=received_total+p_amount,confirmed_at=clock_timestamp(),
  state=case when received_total+p_amount-refunded_total>=requested_amount then 'confirmed' else 'pending' end,
  cancellation_assessed_at=null,refund_due=0,version=version+1,updated_at=clock_timestamp() where id=target.id;
 insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values
 (source.id,a.id,'carry_out',p_actor,'carry-out:'||p_key,jsonb_build_object('to',target.id,'amount',p_amount)),
 (target.id,a.id,'carry_in',p_actor,'carry-in:'||p_key,jsonb_build_object('from',source.id,'amount',p_amount));
 perform public.pm_deposit_rebalance(source.id); perform public.pm_deposit_rebalance(target.id);
 for linked in select ap.id from public.appointments ap join public.booking_deposit_links l on l.appointment_id=ap.id
  join public.booking_preparations b on b.appointment_id=ap.id where l.account_id=target.id and ap.status='pending'
  and not coalesce((b.data->>'approvalRequired')::boolean,false) and public.pm_deposit_can_confirm(ap.id)
 loop
  update public.appointments set status='confirmed',updated_at=clock_timestamp() where id=linked.id;
  insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(target.id,linked.id,'confirmed',target.id||':confirmed:'||linked.id) on conflict do nothing;
 end loop;
end $$;

-- Record real allocation/settlement changes without noisy clear-and-reallocate events.
do $patch$
declare src text;
begin
 select pg_get_functiondef('public.pm_deposit_rebalance(uuid)'::regprocedure) into src;
 if position('update public.booking_deposit_links set allocated_amount=used_amount where account_id=d.id;' in src)=0 then raise exception 'UNEXPECTED_REBALANCE'; end if;
 src:=replace(src,'update public.booking_deposit_links set allocated_amount=used_amount where account_id=d.id;',
 'update public.booking_deposit_links li set allocated_amount=used_amount from public.appointments ap where li.account_id=d.id and ap.id=li.appointment_id and ap.status in (''cancelled'',''rejected'',''noshow'') and li.allocated_amount<>li.used_amount;');
 execute src;
 select pg_get_functiondef('public.pm_deposit_act(text,uuid,text,text,text,integer,text,text,integer)'::regprocedure) into src;
 src:=replace(src,'if p_action=''report'' then','if p_action=''report'' then
  if a.status not in (''pending'',''confirmed'') or not exists(select 1 from public.booking_deposit_links where appointment_id=a.id and requires_deposit) then raise exception ''DEPOSIT_REPORT_NOT_ALLOWED''; end if;');
 execute src;
 select pg_get_functiondef('public.pm_deposit_tick(text,timestamp with time zone)'::regprocedure) into src;
 src:=replace(src,'''cancelled'',d.id||'':expired:''','''expired'',d.id||'':expired:'''); execute src;
 select pg_get_functiondef('public.pm_deposit_booking_changed()'::regprocedure) into src;
 src:=replace(src,'free*percent/100','(free::bigint*percent/100)::integer'); execute src;
 -- A fully refunded same-day rebooking starts a fresh request cycle, never reuses refunded/forfeited money.
 select pg_get_functiondef('public.pm_deposit_attach()'::regprocedure) into src;
 src:=replace(src,'insert into public.booking_deposit_links(appointment_id,account_id,requires_deposit) values(a.id,d.id,needed);',
 'if d.state=''cancelled'' and needed and d.received_total-d.refunded_total-d.used_total-d.forfeited_total=0 then
  update public.booking_deposit_accounts set state=''pending'',report_valid=false,reported_at=null,review_reminded_at=null,cancellation_assessed_at=null,
   retry_count=retry_count+1,retry_due_at=least(a.start_at,clock_timestamp()+make_interval(mins=>coalesce((d.policy_snapshot->>''depositHoldMinutes'')::integer,20))),version=version+1 where id=d.id;
  insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,''request'',d.id||'':rebook:''||a.id);
 end if;
 insert into public.booking_deposit_links(appointment_id,account_id,requires_deposit) values(a.id,d.id,needed);'); execute src;
end $patch$;

-- Cancellation fees are not available money for a later same-day request cycle.
do $coverage$
declare f regprocedure; src text;
begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname in ('pm_deposit_can_confirm','pm_deposit_act','pm_deposit_move_booking','pm_deposit_view','pm_deposit_carry') loop
  select pg_get_functiondef(f) into src;
  src:=replace(src,'d.received_total-d.refunded_total>=d.requested_amount','d.received_total-d.refunded_total-d.forfeited_total>=d.requested_amount');
  src:=replace(src,'d.received_total-d.refunded_total<d.requested_amount','d.received_total-d.refunded_total-d.forfeited_total<d.requested_amount');
  src:=replace(src,'p_amount-d.refunded_total>=d.requested_amount','p_amount-d.refunded_total-d.forfeited_total>=d.requested_amount');
  src:=replace(src,'received_total+amount-refunded_total>=requested_amount','received_total+amount-refunded_total-forfeited_total>=requested_amount');
  src:=replace(src,'received_total+p_amount-refunded_total>=requested_amount','received_total+p_amount-refunded_total-forfeited_total>=requested_amount');
  execute src;
 end loop;
end $coverage$;

create function public.pm_deposit_allocation_audit() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if (old.account_id,old.allocated_amount,old.used_amount,old.settled_at) is distinct from (new.account_id,new.allocated_amount,new.used_amount,new.settled_at) then
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details)
   values(new.account_id,new.appointment_id,case when old.settled_at is null and new.settled_at is not null then 'settled' else 'allocation_changed' end,'system','allocation:'||gen_random_uuid(),
   jsonb_build_object('previousAllocation',old.allocated_amount,'allocation',new.allocated_amount,'previousUsed',old.used_amount,'used',new.used_amount,'previousAccount',old.account_id));
 end if; return new;
end $$;
create trigger deposit_allocation_audit after update on public.booking_deposit_links for each row execute function public.pm_deposit_allocation_audit();

create function public.pm_deposit_event_immutable() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' and not exists(select 1 from public.booking_deposit_accounts where id=old.account_id) then return old; end if;
 if tg_op='UPDATE' and new.appointment_id is null and (to_jsonb(new)-'appointment_id')=(to_jsonb(old)-'appointment_id') then return new; end if;
 raise exception 'DEPOSIT_AUDIT_IMMUTABLE';
end $$;
create trigger deposit_event_immutable before update or delete on public.booking_deposit_events for each row execute function public.pm_deposit_event_immutable();

create function public.pm_deposit_balance_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare ids uuid[]; aid uuid; d public.booking_deposit_accounts%rowtype; allocated bigint; used bigint;
begin
 if tg_table_name='booking_deposit_accounts' then ids:=array[coalesce(new.id,old.id)];
 elsif tg_op='INSERT' then ids:=array[new.account_id]; elsif tg_op='DELETE' then ids:=array[old.account_id]; else ids:=array[old.account_id,new.account_id]; end if;
 foreach aid in array ids loop
  select * into d from public.booking_deposit_accounts where id=aid for update;
  if found then
   select coalesce(sum(allocated_amount),0),coalesce(sum(used_amount),0) into allocated,used from public.booking_deposit_links where account_id=aid;
   if allocated+d.refunded_total+d.forfeited_total+d.refund_due>d.received_total or used<>d.used_total then raise exception 'DEPOSIT_BALANCE_INVARIANT'; end if;
  end if;
 end loop; return null;
end $$;
create constraint trigger deposit_balance_accounts after insert or update on public.booking_deposit_accounts deferrable initially deferred for each row execute function public.pm_deposit_balance_guard();
create constraint trigger deposit_balance_links after insert or update or delete on public.booking_deposit_links deferrable initially deferred for each row execute function public.pm_deposit_balance_guard();

create function public.pm_deposit_cancellation_notice() returns trigger language plpgsql security invoker set search_path='' as $$
declare aid uuid; kind text;
begin
 if new.status not in ('cancelled','rejected') or old.status=new.status then return new; end if;
 select account_id into aid from public.booking_deposit_links where appointment_id=new.id;
 if aid is null then return new; end if;
 select data#>>'{cancellation,kind}' into kind from public.booking_preparations where appointment_id=new.id;
 if kind='deposit_expired' then return new; end if;
 insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key)
 values(aid,new.id,case when kind='owner' then 'owner_cancelled' else 'cancelled' end,aid||':cancelled:'||new.id||':'||new.updated_at) on conflict do nothing;
 return new;
end $$;
create trigger zzz_deposit_cancellation_notice after update of status on public.appointments for each row execute function public.pm_deposit_cancellation_notice();

do $acl$
declare f regprocedure;
begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'pm_deposit_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f); execute format('grant execute on function %s to service_role',f);
 end loop;
end $acl$;
commit;
