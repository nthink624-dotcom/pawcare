-- Forward-only deposit ledger. Existing preparations are deliberately NOT backfilled.
-- Reviewed application is separate from development-only clock installation.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
lock table public.appointments,public.booking_preparations,public.shop_booking_policies in share row exclusive mode;
create table public.booking_deposit_activation(singleton boolean primary key default true check(singleton), activated_at timestamptz not null);
insert into public.booking_deposit_activation values(true,clock_timestamp());
alter table public.booking_deposit_activation enable row level security;
revoke all on public.booking_deposit_activation from public,anon,authenticated;
grant select on public.booking_deposit_activation to service_role;

alter table public.guardians add column deposit_exception text not null default 'inherit'
  check (deposit_exception in ('inherit','always','exempt'));
alter table public.guardians add column established_customer boolean not null default false;

create table public.booking_deposit_accounts (
 id uuid primary key default gen_random_uuid(), shop_id text not null references public.shops(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade, booking_date date not null,
 policy_snapshot jsonb not null, reason text not null,
 requested_amount integer not null check(requested_amount>0), due_at timestamptz not null,
 state text not null default 'pending' check(state in ('pending','reported','confirmed','waived','cancelled')),
 received_total integer not null default 0 check(received_total>=0), refunded_total integer not null default 0 check(refunded_total>=0),
 used_total integer not null default 0 check(used_total>=0), forfeited_total integer not null default 0 check(forfeited_total>=0),
 refund_due integer not null default 0 check(refund_due>=0), payer_name text not null default '',
 reported_at timestamptz, report_valid boolean not null default false, confirmed_at timestamptz,
 review_reminded_at timestamptz, retry_due_at timestamptz, retry_count integer not null default 0,
 cancellation_assessed_at timestamptz, version integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(shop_id,guardian_id,booking_date),
 check(refunded_total+used_total+forfeited_total+refund_due<=received_total)
);
create table public.booking_deposit_links (
 appointment_id uuid primary key references public.appointments(id) on delete cascade,
 account_id uuid not null references public.booking_deposit_accounts(id) on delete cascade,
 requires_deposit boolean not null, allocated_amount integer not null default 0 check(allocated_amount>=0),
 used_amount integer not null default 0 check(used_amount>=0), settled_at timestamptz, auto_confirmed_unverified boolean not null default false,
 created_at timestamptz not null default now(), check(used_amount<=allocated_amount)
);
create index booking_deposit_links_account_idx on public.booking_deposit_links(account_id);
create index booking_deposit_accounts_clock_idx on public.booking_deposit_accounts(state,due_at);
create table public.booking_deposit_events (
 id bigint generated always as identity primary key, account_id uuid not null references public.booking_deposit_accounts(id) on delete cascade,
 appointment_id uuid references public.appointments(id) on delete set null,
 action text not null, actor text not null, request_key text not null, details jsonb not null default '{}',
 created_at timestamptz not null default clock_timestamp(), unique(account_id,request_key)
);
create index booking_deposit_events_account_idx on public.booking_deposit_events(account_id,id);
create table public.booking_deposit_outbox (
 id uuid primary key default gen_random_uuid(), account_id uuid not null references public.booking_deposit_accounts(id) on delete cascade,
 appointment_id uuid not null references public.appointments(id) on delete cascade, purpose text not null,
 dedupe_key text not null unique, state text not null default 'pending' check(state in ('pending','processing','sent','mocked','blocked','failed')),
 created_at timestamptz not null default now(), processed_at timestamptz, reason text
);
create index booking_deposit_outbox_pending_idx on public.booking_deposit_outbox(state,created_at);
create table public.booking_deposit_preferences_audit (
 id bigint generated always as identity primary key, shop_id text not null references public.shops(id) on delete cascade,
 guardian_id uuid not null references public.guardians(id) on delete cascade, actor text not null,
 previous_value jsonb not null, next_value jsonb not null, created_at timestamptz not null default now()
);
alter table public.booking_deposit_preferences_audit enable row level security;
revoke all on public.booking_deposit_preferences_audit from public,anon,authenticated;
grant select,insert,delete on public.booking_deposit_preferences_audit to service_role;
grant usage,select on sequence public.booking_deposit_preferences_audit_id_seq to service_role;

alter table public.booking_deposit_accounts enable row level security;
alter table public.booking_deposit_links enable row level security;
alter table public.booking_deposit_events enable row level security;
alter table public.booking_deposit_outbox enable row level security;
revoke all on public.booking_deposit_accounts,public.booking_deposit_links,public.booking_deposit_events,public.booking_deposit_outbox from public,anon,authenticated;
grant select,insert,update,delete on public.booking_deposit_accounts,public.booking_deposit_links,public.booking_deposit_events,public.booking_deposit_outbox to service_role;
grant usage,select on sequence public.booking_deposit_events_id_seq to service_role;

create function public.pm_deposit_identity_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_table_name='booking_deposit_accounts' then
  if not exists(select 1 from public.guardians where id=new.guardian_id and shop_id=new.shop_id) then raise exception 'DEPOSIT_TENANT_MISMATCH'; end if;
  if tg_op='UPDATE' and (old.shop_id,old.guardian_id,old.booking_date,old.policy_snapshot,old.requested_amount) is distinct from (new.shop_id,new.guardian_id,new.booking_date,new.policy_snapshot,new.requested_amount) then raise exception 'DEPOSIT_SNAPSHOT_IMMUTABLE'; end if;
 elsif tg_table_name='booking_deposit_links' then
  if not exists(select 1 from public.appointments a join public.booking_deposit_accounts d on d.shop_id=a.shop_id and d.guardian_id=a.guardian_id where a.id=new.appointment_id and d.id=new.account_id) then raise exception 'DEPOSIT_TENANT_MISMATCH'; end if;
 end if;
 return new;
end $$;
create trigger deposit_account_identity before insert or update on public.booking_deposit_accounts for each row execute function public.pm_deposit_identity_guard();
create trigger deposit_link_identity before insert or update on public.booking_deposit_links for each row execute function public.pm_deposit_identity_guard();

create function public.pm_deposit_decision(p_shop text,p_guardian uuid,p_date date,p_exclude uuid default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare p jsonb; g public.guardians%rowtype; n integer; reason text; base text; rule text; first_visit boolean;
begin
 select policy into p from public.shop_booking_policies where shop_id=p_shop;
 select * into g from public.guardians where id=p_guardian and shop_id=p_shop;
 if p is null or coalesce(p->>'depositMode','off')='off' then return jsonb_build_object('required',false,'reason','off'); end if;
 if g.deposit_exception='exempt' then return jsonb_build_object('required',false,'reason','exempt'); end if;
 select c.rule into rule from public.guardian_booking_conditions c where c.shop_id=p_shop and c.guardian_id=p_guardian;
 select count(*) into n from public.appointments a where a.shop_id=p_shop and a.guardian_id=p_guardian and a.status='noshow'
   and a.appointment_date>=current_date-coalesce((p->>'depositNoShowDays')::integer,180) and a.id is distinct from p_exclude;
 first_visit:=not coalesce(g.established_customer,false) and not exists(select 1 from public.appointments a where a.shop_id=p_shop and a.guardian_id=p_guardian and a.status='completed' and a.id is distinct from p_exclude)
   and not exists(select 1 from public.grooming_records r where r.shop_id=p_shop and r.guardian_id=p_guardian);
 base:=coalesce(p->>'depositBase',case p->>'depositAudience' when 'new' then 'first_visit' when 'noshow' then 'none' else 'all' end);
 if g.deposit_exception='always' or rule='deposit' then reason:='always';
 elsif coalesce((p->>'depositNoShowEnabled')::boolean,p->>'depositAudience'='noshow',false) and n>=coalesce((p->>'depositNoShowCount')::integer,1) then reason:='noshow';
 elsif base='all' then reason:='all';
 elsif base='first_visit' and first_visit and not exists(select 1 from public.booking_deposit_accounts d where d.shop_id=p_shop and d.guardian_id=p_guardian and d.received_total>d.refunded_total) then reason:='first_visit';
 end if;
 return jsonb_build_object('required',reason is not null,'reason',coalesce(reason,'not_target'),'firstVisit',first_visit,'noShowCount',n);
end $$;
create function public.pm_deposit_required(p_shop text,p_guardian uuid,p_date date,p_exclude uuid default null)
returns boolean language sql security invoker set search_path='' as $$ select coalesce((public.pm_deposit_decision(p_shop,p_guardian,p_date,p_exclude)->>'required')::boolean,false) $$;

-- Account row lock serializes every money mutation, allocation and same-day regrouping.
create function public.pm_deposit_rebalance(p_account uuid) returns void language plpgsql security invoker set search_path='' as $$
declare d public.booking_deposit_accounts%rowtype; l record; remaining integer; portion integer; total_used integer:=0;
begin
 select * into d from public.booking_deposit_accounts where id=p_account for update;
 if not found then return; end if;
 select coalesce(sum(used_amount),0) into total_used from public.booking_deposit_links where account_id=d.id;
 remaining:=d.received_total-d.refunded_total-d.forfeited_total-d.refund_due-total_used;
 if remaining<0 then raise exception 'DEPOSIT_MONEY_ALREADY_USED'; end if;
 update public.booking_deposit_links set allocated_amount=used_amount where account_id=d.id;
 for l in select b.appointment_id,b.used_amount,b.settled_at,a.status,greatest(coalesce(a.final_service_price,s.price,0),0) as price
   from public.booking_deposit_links b join public.appointments a on a.id=b.appointment_id left join public.services s on s.id=a.service_id
   where b.account_id=d.id and a.status not in ('cancelled','rejected','noshow') order by a.start_at,a.id
 loop
  if l.status='completed' and l.settled_at is not null then continue; end if;
  portion:=least(remaining,greatest(0,l.price-l.used_amount)); remaining:=remaining-portion;
  update public.booking_deposit_links set allocated_amount=used_amount+portion,
    used_amount=case when l.status='completed' then used_amount+portion else used_amount end,
    settled_at=case when l.status='completed' then clock_timestamp() else settled_at end where appointment_id=l.appointment_id;
 end loop;
 select coalesce(sum(used_amount),0) into total_used from public.booking_deposit_links where account_id=d.id;
 update public.booking_deposit_accounts set used_total=total_used,updated_at=clock_timestamp() where id=d.id;
 if d.state<>'cancelled' and not exists(select 1 from public.booking_deposit_links li join public.appointments ap on ap.id=li.appointment_id where li.account_id=d.id and ap.status not in ('completed','cancelled','rejected','noshow')) then
  update public.booking_deposit_accounts set refund_due=received_total-refunded_total-total_used-forfeited_total where id=d.id;
 end if;
 -- Projection is not a second money source. Other reservations never receive the same allocated won.
 update public.booking_preparations b set data=jsonb_set(b.data,'{deposit}',(b.data->'deposit')||jsonb_build_object(
   'status',case when d.state='cancelled' then 'cancelled' else d.state end,'required',allocation.requires_deposit,'amount',d.requested_amount,
   'receivedAmount',allocation.allocated_amount,'refundedAmount',0,'dueAt',d.due_at,'releaseIfUnreported',allocation.requires_deposit,
   'payerName',d.payer_name,'reportedAt',d.reported_at,'confirmedAt',d.confirmed_at,'confirmedBy',null)),
   version=version+1,updated_at=clock_timestamp()
 from public.booking_deposit_links allocation where allocation.account_id=d.id and b.appointment_id=allocation.appointment_id;
end $$;

create function public.pm_deposit_attach() returns trigger language plpgsql security invoker set search_path='' as $$
declare a public.appointments%rowtype; d public.booking_deposit_accounts%rowtype; decision jsonb; needed boolean; snapshot jsonb; deadline timestamptz;
begin
 select * into a from public.appointments where id=new.appointment_id;
 -- Late consent initialization of an existing booking must never retroactively levy a deposit.
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
 insert into public.booking_deposit_links(appointment_id,account_id,requires_deposit) values(a.id,d.id,needed);
 insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,a.id,'linked','system','linked:'||a.id,jsonb_build_object('reason',decision->>'reason'));
 update public.booking_deposit_accounts set due_at=least(due_at,a.start_at),refund_due=0 where id=d.id and state<>'cancelled';
 perform public.pm_deposit_rebalance(d.id);
 if needed and (select state in ('confirmed','waived') from public.booking_deposit_accounts where id=d.id) then
  update public.appointments set status='confirmed' where id=a.id and status='pending' and not coalesce((new.data->>'approvalRequired')::boolean,false);
 end if;
 return new;
end $$;
create trigger zz_deposit_attach after insert on public.booking_preparations for each row execute function public.pm_deposit_attach();

create function public.pm_deposit_can_confirm(p_appointment uuid) returns boolean language sql security invoker set search_path='' as $$
 select coalesce((select case when l.appointment_id is null then b.data#>>'{deposit,status}' in ('confirmed','waived')
   else not l.requires_deposit or d.state='waived' or (d.state='confirmed' and d.received_total-d.refunded_total>=d.requested_amount)
    or (d.report_valid and d.reported_at is not null and a.start_at<=clock_timestamp())
    or (a.status='noshow' and d.forfeited_total>0) end
 from public.appointments a join public.booking_preparations b on b.appointment_id=a.id
 left join public.booking_deposit_links l on l.appointment_id=a.id left join public.booking_deposit_accounts d on d.id=l.account_id
 where a.id=p_appointment),false)
$$;

create function public.pm_deposit_act(p_shop text,p_appointment uuid,p_action text,p_key text,p_actor text,p_amount integer default null,p_name text default null,p_note text default '',p_version integer default null)
returns uuid language plpgsql security invoker set search_path='' as $$
declare d public.booking_deposit_accounts%rowtype; a public.appointments%rowtype; old_total integer; old_refund integer; target record; deadline timestamptz;
begin
 select * into a from public.appointments where id=p_appointment and shop_id=p_shop;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop||':'||a.guardian_id::text,71));
 select x.* into d from public.booking_deposit_accounts x join public.booking_deposit_links l on l.account_id=x.id
  where l.appointment_id=a.id and x.shop_id=p_shop and x.guardian_id=a.guardian_id for update of x;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 if coalesce(length(p_key),0) not between 8 and 160 then raise exception 'DEPOSIT_REQUEST_KEY_REQUIRED'; end if;
 if exists(select 1 from public.booking_deposit_events where account_id=d.id and request_key=p_key) then return d.id; end if;
 if p_version is not null and d.version<>p_version then raise exception 'DEPOSIT_VERSION_CONFLICT'; end if;
 old_total:=d.received_total; old_refund:=d.refunded_total;
 if p_action='report' then
  deadline:=coalesce(d.retry_due_at,d.due_at);
  if d.state not in ('pending','reported') or (not d.report_valid and deadline<=clock_timestamp()) then raise exception 'BOOKING_DEPOSIT_EXPIRED'; end if;
  if coalesce(length(trim(p_name)),0) not between 1 and 50 then raise exception 'DEPOSIT_PAYER_REQUIRED'; end if;
  d.payer_name:=trim(p_name);
  if not d.report_valid then d.reported_at:=clock_timestamp(); end if;
  d.report_valid:=true; d.state:='reported';
 elsif p_action in ('confirm','correct') then
  if p_amount is null or p_amount<0 or p_amount>10000000 or p_amount<d.used_total+d.refunded_total+d.forfeited_total then raise exception 'DEPOSIT_MONEY_ALREADY_USED'; end if;
  if p_action='correct' and length(trim(p_note))=0 then raise exception 'DEPOSIT_REASON_REQUIRED'; end if;
  d.received_total:=p_amount; d.confirmed_at:=clock_timestamp(); d.refund_due:=least(d.refund_due,p_amount-d.used_total-d.refunded_total-d.forfeited_total);
  if p_name is not null and length(trim(p_name))>0 then d.payer_name:=left(trim(p_name),50); end if;
  if d.state='cancelled' or not exists(select 1 from public.booking_deposit_links l join public.appointments ap on ap.id=l.appointment_id where l.account_id=d.id and ap.status not in ('cancelled','rejected','noshow')) then
   -- An actual late payment never resurrects a cancelled reservation.
   d.state:='cancelled'; d.forfeited_total:=0; d.refund_due:=p_amount-d.used_total-d.refunded_total;
  else d.state:=case when p_amount-d.refunded_total>=d.requested_amount then 'confirmed' when d.report_valid then 'reported' else 'pending' end; end if;
 elsif p_action='refund' then
  if p_amount is null or p_amount<=0 or p_amount>d.received_total-d.refunded_total-d.used_total-d.forfeited_total then raise exception 'DEPOSIT_REFUND_EXCEEDS_AVAILABLE'; end if;
  if length(trim(p_note))=0 then raise exception 'DEPOSIT_REASON_REQUIRED'; end if;
  d.refunded_total:=d.refunded_total+p_amount; d.refund_due:=greatest(0,d.refund_due-p_amount);
 elsif p_action='retry' then
  if length(trim(p_note))=0 then raise exception 'DEPOSIT_REASON_REQUIRED'; end if;
  d.state:='pending'; d.report_valid:=false; d.review_reminded_at:=null; d.retry_count:=d.retry_count+1;
  d.retry_due_at:=case when a.start_at>clock_timestamp() then least(a.start_at,clock_timestamp()+make_interval(mins=>coalesce((d.policy_snapshot->>'depositHoldMinutes')::integer,20))) else clock_timestamp()+make_interval(mins=>coalesce((d.policy_snapshot->>'depositHoldMinutes')::integer,20)) end;
  insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'request',d.id||':request:'||d.retry_count);
 elsif p_action='waive' then
  if d.received_total>d.refunded_total or length(trim(p_note))=0 then raise exception 'DEPOSIT_REFUND_OR_REASON_REQUIRED'; end if;
  d.state:='waived';
 else raise exception 'DEPOSIT_ACTION_NOT_ALLOWED'; end if;
 d.version:=d.version+1;
 update public.booking_deposit_accounts set state=d.state,received_total=d.received_total,refunded_total=d.refunded_total,
  refund_due=d.refund_due,forfeited_total=d.forfeited_total,payer_name=d.payer_name,reported_at=d.reported_at,report_valid=d.report_valid,
  confirmed_at=d.confirmed_at,retry_count=d.retry_count,retry_due_at=d.retry_due_at,review_reminded_at=d.review_reminded_at,
  version=d.version,updated_at=clock_timestamp() where id=d.id;
 insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details)
 values(d.id,a.id,p_action,p_actor,p_key,jsonb_build_object('note',left(p_note,2000),'previousTotal',old_total,'total',d.received_total,'previousRefund',old_refund,'refunded',d.refunded_total,'payerName',d.payer_name,'reportedAt',d.reported_at));
 perform public.pm_deposit_rebalance(d.id);
 if d.state in ('confirmed','waived') then
  update public.booking_deposit_links set auto_confirmed_unverified=false where account_id=d.id;
  for target in select ap.id from public.appointments ap join public.booking_deposit_links l on l.appointment_id=ap.id
   join public.booking_preparations b on b.appointment_id=ap.id where l.account_id=d.id and ap.status='pending' and not coalesce((b.data->>'approvalRequired')::boolean,false)
  loop
   update public.appointments set status='confirmed',updated_at=clock_timestamp() where id=target.id;
   insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,target.id,'confirmed',d.id||':confirmed:'||target.id) on conflict do nothing;
  end loop;
 end if;
 if p_action='refund' then insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'refunded',d.id||':refund:'||p_key); end if;
 return d.id;
end $$;

create function public.pm_deposit_booking_changed() returns trigger language plpgsql security invoker set search_path='' as $$
declare d public.booking_deposit_accounts%rowtype; kind text; free integer; percent integer:=100; hours_before numeric; bracket jsonb;
begin
 select x.* into d from public.booking_deposit_accounts x join public.booking_deposit_links l on l.account_id=x.id where l.appointment_id=new.id for update of x;
 if not found then return new; end if;
 if old.appointment_date is distinct from new.appointment_date and current_setting('petmanager.deposit_move',true) is distinct from new.id::text then raise exception 'DEPOSIT_TRANSFER_DECISION_REQUIRED'; end if;
 if new.start_at is distinct from old.start_at then update public.booking_deposit_accounts set due_at=least(due_at,new.start_at),version=version+1 where id=d.id; end if;
 if old.status='noshow' and new.status not in ('noshow','cancelled','rejected') then
  update public.booking_deposit_accounts set forfeited_total=0,refund_due=0,cancellation_assessed_at=null,
   state=case when received_total-refunded_total>=requested_amount then 'confirmed' when report_valid then 'reported' else 'pending' end,version=version+1 where id=d.id;
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key) values(d.id,new.id,'noshow_corrected','owner','noshow-corrected:'||gen_random_uuid());
 end if;
 if new.status='completed' and old.final_service_price is distinct from new.final_service_price then
  update public.booking_deposit_links set used_amount=least(used_amount,greatest(coalesce(new.final_service_price,0),0)),allocated_amount=least(allocated_amount,greatest(coalesce(new.final_service_price,0),0)) where appointment_id=new.id;
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,new.id,'service_price_corrected','owner','price:'||gen_random_uuid(),jsonb_build_object('previous',old.final_service_price,'current',new.final_service_price));
 end if;
 if new.status in ('cancelled','rejected','noshow') and old.status is distinct from new.status and d.cancellation_assessed_at is null
  and not exists(select 1 from public.booking_deposit_links l join public.appointments a on a.id=l.appointment_id where l.account_id=d.id and a.status not in ('cancelled','rejected','noshow','completed')) then
  select data#>>'{cancellation,kind}' into kind from public.booking_preparations where appointment_id=new.id;
  free:=d.received_total-d.refunded_total-d.used_total-d.forfeited_total;
  if new.status='noshow' then percent:=coalesce((d.policy_snapshot->>'depositNoShowRefundPercent')::integer,0);
  elsif kind in ('customer','late_customer') then
   hours_before:=extract(epoch from (new.start_at-clock_timestamp()))/3600;
   for bracket in select value from jsonb_array_elements(coalesce(d.policy_snapshot->'depositRefundRules','[{"hoursBefore":0,"percent":100}]')) order by (value->>'hoursBefore')::numeric desc loop
    if hours_before>=(bracket->>'hoursBefore')::numeric then percent:=(bracket->>'percent')::integer; exit; end if;
   end loop;
  end if;
  percent:=greatest(0,least(100,percent));
  update public.booking_deposit_accounts set state='cancelled',refund_due=(free*percent/100),forfeited_total=forfeited_total+free-(free*percent/100),cancellation_assessed_at=clock_timestamp(),version=version+1 where id=d.id;
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,new.id,'cancellation_assessed','system','cancellation:'||gen_random_uuid(),jsonb_build_object('kind',coalesce(kind,new.status),'refundPercent',percent,'remaining',free));
 end if;
 perform public.pm_deposit_rebalance(d.id);
 if new.status='completed' and not exists(select 1 from public.booking_deposit_links l join public.appointments a on a.id=l.appointment_id where l.account_id=d.id and a.status not in ('completed','cancelled','rejected','noshow')) then
  update public.booking_deposit_accounts set refund_due=received_total-refunded_total-used_total-forfeited_total where id=d.id;
 end if;
 return new;
end $$;
create trigger zz_deposit_booking_changed after update of status,start_at,final_service_price on public.appointments for each row execute function public.pm_deposit_booking_changed();

-- Same-day target decisions and money snapshots are database-authoritative on both owner and customer inserts.
do $patch$
declare src text;
begin
 select pg_get_functiondef('public.prepare_booking_policy()'::regprocedure) into src;
 if position('required := rule = ''deposit'' or (p->>''depositMode'' = ''required'' and applies);' in src)=0 then raise exception 'UNEXPECTED_BOOKING_POLICY_SOURCE'; end if;
 src:=replace(src,'required := rule = ''deposit'' or (p->>''depositMode'' = ''required'' and applies);','required := public.pm_deposit_required(new.shop_id,new.guardian_id,new.appointment_date,new.id);');
 src:=replace(src,'and p#>>''{deposit,status}'' not in (''confirmed'', ''waived'')','and not public.pm_deposit_can_confirm(new.id)');
 execute src;
 select pg_get_functiondef('public.snapshot_booking_policy()'::regprocedure) into src;
 if position('required := rule = ''deposit'' or (p->>''depositMode'' = ''required'' and applies);' in src)=0 then raise exception 'UNEXPECTED_SNAPSHOT_SOURCE'; end if;
 src:=replace(src,'required := rule = ''deposit'' or (p->>''depositMode'' = ''required'' and applies);','required := public.pm_deposit_required(new.shop_id,new.guardian_id,new.appointment_date,new.id);');
 execute src;
end $patch$;

create function public.pm_deposit_tick(p_shop text default null,p_now timestamptz default clock_timestamp()) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare d public.booking_deposit_accounts%rowtype; a record; expired integer:=0; confirmed integer:=0; reminders integer:=0;
begin
 -- Only ledger-linked new bookings participate. No legacy rows and no message HTTP calls.
 for d in select * from public.booking_deposit_accounts where (p_shop is null or shop_id=p_shop) and state in ('pending','reported') order by id for update skip locked
 loop
  if d.state='pending' and not d.report_valid and coalesce(d.retry_due_at,d.due_at)<=p_now then
   for a in select ap.id from public.appointments ap join public.booking_deposit_links l on l.appointment_id=ap.id where l.account_id=d.id and l.requires_deposit and ap.status='pending' order by ap.id for update of ap skip locked loop
    update public.booking_preparations set data=jsonb_set(data,'{cancellation}',jsonb_build_object('kind','deposit_expired','reason','입금 신고 기한 경과','at',p_now)),version=version+1 where appointment_id=a.id;
    update public.appointments set status='cancelled',updated_at=clock_timestamp() where id=a.id;
    insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'cancelled',d.id||':expired:'||a.id) on conflict do nothing;
    expired:=expired+1;
   end loop;
  elsif d.state='reported' and d.report_valid then
   if d.reported_at+make_interval(mins=>coalesce((d.policy_snapshot->>'depositReviewMinutes')::integer,30))<=p_now and (d.review_reminded_at is null or d.review_reminded_at+make_interval(mins=>coalesce((d.policy_snapshot->>'depositReviewMinutes')::integer,30))<=p_now) then
    update public.booking_deposit_accounts set review_reminded_at=p_now where id=d.id;
    insert into public.booking_deposit_events(account_id,action,actor,request_key) values(d.id,'review_reminder','system','review:'||gen_random_uuid()); reminders:=reminders+1;
   end if;
   for a in select ap.id from public.appointments ap join public.booking_deposit_links l on l.appointment_id=ap.id join public.booking_preparations b on b.appointment_id=ap.id
    where l.account_id=d.id and ap.status='pending' and ap.start_at<=p_now and not coalesce((b.data->>'approvalRequired')::boolean,false) order by ap.id for update of ap skip locked loop
    update public.booking_deposit_links set auto_confirmed_unverified=true where appointment_id=a.id;
    update public.appointments set status='confirmed',updated_at=clock_timestamp() where id=a.id;
    insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key) values(d.id,a.id,'start_auto_confirmed','system','auto-confirm:'||a.id) on conflict do nothing;
    insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(d.id,a.id,'confirmed',d.id||':confirmed:'||a.id) on conflict do nothing;
    confirmed:=confirmed+1;
   end loop;
  end if;
 end loop;
 return jsonb_build_object('expired',expired,'autoConfirmed',confirmed,'reminders',reminders);
end $$;

-- Existing callers remain valid. Legacy expiry excludes the ledger; ledger actions own its group state.
do $patch$
declare src text;
begin
 select pg_get_functiondef('public.expire_unreported_booking_deposits(text,uuid,text,uuid)'::regprocedure) into src;
 if position('where ap.shop_id=p_shop' in src)=0 then raise exception 'UNEXPECTED_EXPIRY_SOURCE'; end if;
 src:=replace(src,'where ap.shop_id=p_shop','where not exists(select 1 from public.booking_deposit_links dl where dl.appointment_id=ap.id) and ap.shop_id=p_shop');
 src:=replace(src,'return expired;','return expired+(select (v->>''expired'')::integer+(v->>''autoConfirmed'')::integer from public.pm_deposit_tick(p_shop) as t(v));');
 execute src;
end $patch$;

create function public.pm_deposit_view(p_shop text,p_appointment uuid) returns jsonb language sql security invoker set search_path='' as $$
 select jsonb_build_object('id',d.id,'version',d.version,'state',d.state,'reason',d.reason,'bookingDate',d.booking_date,
  'requestedAmount',d.requested_amount,'receivedTotal',d.received_total,'refundedTotal',d.refunded_total,'usedTotal',d.used_total,
  'forfeitedTotal',d.forfeited_total,'refundDue',d.refund_due,'availableTotal',d.received_total-d.refunded_total-d.used_total-d.forfeited_total,
  'allocatedAmount',l.allocated_amount,'usedAmount',l.used_amount,'dueAt',d.due_at,'retryDueAt',d.retry_due_at,'retryCount',d.retry_count,
  'payerName',d.payer_name,'reportedAt',d.reported_at,'reportValid',d.report_valid,'confirmedAt',d.confirmed_at,
  'reviewRemindedAt',d.review_reminded_at,'requiresDeposit',l.requires_deposit,
  'unverified',l.auto_confirmed_unverified or (a.status in ('confirmed','in_progress','almost_done','completed') and l.requires_deposit and d.state<>'waived' and d.received_total-d.refunded_total<d.requested_amount),
  'bookingCount',(select count(*) from public.booking_deposit_links where account_id=d.id),
  'refundRules',coalesce(d.policy_snapshot->'depositRefundRules','[{"hoursBefore":0,"percent":100}]'),
  'noShowRefundPercent',coalesce((d.policy_snapshot->>'depositNoShowRefundPercent')::integer,0),
  'bankName',d.policy_snapshot->>'bankName','bankAccount',d.policy_snapshot->>'bankAccount','bankHolder',d.policy_snapshot->>'bankHolder',
  'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.created_at,'details',e.details) order by e.id) from public.booking_deposit_events e where e.account_id=d.id),'[]'))
 from public.booking_deposit_links l join public.booking_deposit_accounts d on d.id=l.account_id join public.appointments a on a.id=l.appointment_id
 where l.appointment_id=p_appointment and d.shop_id=p_shop and a.shop_id=p_shop
$$;

create function public.pm_deposit_preview(p_shop text,p_name text,p_phone text,p_date date default current_date) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare g uuid; p jsonb; d public.booking_deposit_accounts%rowtype; decision jsonb;
begin
 select id into g from public.guardians where shop_id=p_shop and deleted_at is null
  and lower(regexp_replace(name,'\s','','g'))=lower(regexp_replace(p_name,'\s','','g'))
  and regexp_replace(phone,'[^0-9]','','g')=regexp_replace(p_phone,'[^0-9]','','g') order by created_at limit 1;
 select policy into p from public.shop_booking_policies where shop_id=p_shop;
 decision:=public.pm_deposit_decision(p_shop,g,p_date);
 select * into d from public.booking_deposit_accounts where shop_id=p_shop and guardian_id=g and booking_date=p_date;
 if d.id is not null and d.state in ('confirmed','waived') then decision:=decision||'{"required":false,"reason":"same_day_paid"}'; end if;
 return jsonb_build_object('eligible',coalesce((decision->>'required')::boolean,false),'required',coalesce((decision->>'required')::boolean,false),'selectable',false,
 'amount',coalesce(d.requested_amount,(p->>'depositAmount')::integer,0),'holdMinutes',coalesce((p->>'depositHoldMinutes')::integer,20),
 'bankName',coalesce(d.policy_snapshot->>'bankName',p->>'bankName',''),'bankAccount',coalesce(d.policy_snapshot->>'bankAccount',p->>'bankAccount',''),
 'bankHolder',coalesce(d.policy_snapshot->>'bankHolder',p->>'bankHolder',''),'reason',decision->>'reason',
 'refundRules',coalesce(d.policy_snapshot->'depositRefundRules',p->'depositRefundRules','[{"hoursBefore":0,"percent":100}]'),
 'noShowRefundPercent',coalesce((p->>'depositNoShowRefundPercent')::integer,0));
end $$;

create function public.pm_deposit_set_customer(p_shop text,p_guardian uuid,p_exception text,p_established boolean,p_actor text) returns void
language plpgsql security invoker set search_path='' as $$
declare g public.guardians%rowtype;
begin
 if p_exception not in ('inherit','always','exempt') or p_established is null then raise exception 'DEPOSIT_INVALID_PREFERENCE'; end if;
 select * into g from public.guardians where shop_id=p_shop and id=p_guardian for update;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 insert into public.booking_deposit_preferences_audit(shop_id,guardian_id,actor,previous_value,next_value) values(p_shop,p_guardian,p_actor,
  jsonb_build_object('exception',g.deposit_exception,'established',g.established_customer),jsonb_build_object('exception',p_exception,'established',p_established));
 update public.guardians set deposit_exception=p_exception,established_customer=p_established,updated_at=clock_timestamp() where id=g.id;
end $$;

create function public.pm_deposit_move_booking(p_shop text,p_appointment uuid,p_values jsonb,p_transfer boolean default null,p_actor text default 'owner') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.appointments%rowtype; d public.booking_deposit_accounts%rowtype; target public.booking_deposit_accounts%rowtype; v public.appointments%rowtype; linked public.booking_deposit_links%rowtype; amount integer:=0;
begin
 select * into a from public.appointments where id=p_appointment and shop_id=p_shop;
 if not found then raise exception 'DEPOSIT_NOT_FOUND'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_shop||':'||a.guardian_id::text,71));
 select * into a from public.appointments where id=p_appointment and shop_id=p_shop for update;
 select * into linked from public.booking_deposit_links where appointment_id=a.id;
 select * into d from public.booking_deposit_accounts where id=linked.account_id for update;
 v:=jsonb_populate_record(a,p_values);
 if d.id is not null and a.appointment_date<>v.appointment_date then
  if p_transfer is null then raise exception 'DEPOSIT_TRANSFER_DECISION_REQUIRED'; end if;
  select * into target from public.booking_deposit_accounts where shop_id=p_shop and guardian_id=a.guardian_id and booking_date=v.appointment_date for update;
  if target.id is not null and (target.requested_amount<>d.requested_amount or (target.policy_snapshot->>'bankAccount') is distinct from (d.policy_snapshot->>'bankAccount')) then raise exception 'DEPOSIT_TRANSFER_REVIEW_REQUIRED'; end if;
  if target.id is null then
   insert into public.booking_deposit_accounts(shop_id,guardian_id,booking_date,policy_snapshot,reason,requested_amount,due_at)
   values(p_shop,a.guardian_id,v.appointment_date,d.policy_snapshot,d.reason,d.requested_amount,least(d.due_at,v.start_at)) returning * into target;
  end if;
  if p_transfer then
   amount:=least(d.received_total-d.refunded_total-d.used_total-d.forfeited_total,linked.allocated_amount-linked.used_amount);
   if not exists(select 1 from public.booking_deposit_links l join public.appointments ap on ap.id=l.appointment_id where l.account_id=d.id and ap.id<>a.id and ap.status not in ('cancelled','rejected','noshow','completed')) then amount:=d.received_total-d.refunded_total-d.used_total-d.forfeited_total; end if;
   update public.booking_deposit_accounts set received_total=received_total-amount,refund_due=greatest(0,refund_due-amount),version=version+1 where id=d.id;
   update public.booking_deposit_accounts set received_total=received_total+amount,
    state=case when received_total+amount-refunded_total>=requested_amount then 'confirmed' when d.report_valid and d.received_total=0 then 'reported' else state end,
    report_valid=report_valid or (d.report_valid and d.received_total=0),reported_at=coalesce(reported_at,case when d.received_total=0 then d.reported_at end),payer_name=case when payer_name='' then d.payer_name else payer_name end,
    due_at=least(due_at,d.due_at,v.start_at),version=version+1 where id=target.id;
  end if;
  update public.booking_deposit_links set account_id=target.id,allocated_amount=0 where appointment_id=a.id and used_amount=0;
  if not found then raise exception 'DEPOSIT_MONEY_ALREADY_USED'; end if;
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(d.id,a.id,'date_moved_out',p_actor,'move-out:'||gen_random_uuid(),jsonb_build_object('to',target.id,'amount',amount));
  insert into public.booking_deposit_events(account_id,appointment_id,action,actor,request_key,details) values(target.id,a.id,'date_moved_in',p_actor,'move-in:'||gen_random_uuid(),jsonb_build_object('from',d.id,'amount',amount,'transfer',p_transfer));
  perform public.pm_deposit_rebalance(d.id);
  if not exists(select 1 from public.booking_deposit_links li join public.appointments ap on ap.id=li.appointment_id where li.account_id=d.id and ap.status not in ('cancelled','rejected','noshow','completed')) then
   update public.booking_deposit_accounts set state='cancelled',report_valid=false,refund_due=received_total-refunded_total-used_total-forfeited_total where id=d.id;
  end if;
  if not p_transfer then insert into public.booking_deposit_outbox(account_id,appointment_id,purpose,dedupe_key) values(target.id,a.id,'request',target.id||':request:0') on conflict do nothing; end if;
 end if;
 perform set_config('petmanager.deposit_move',a.id::text,true);
 -- All schedule/capacity/permission checks still run in the application and overlap trigger.
 update public.appointments set service_id=v.service_id,staff_id=v.staff_id,appointment_date=v.appointment_date,appointment_time=v.appointment_time,
  memo=v.memo,status=v.status,rejection_reason=v.rejection_reason,start_at=v.start_at,end_at=v.end_at,original_service_price=v.original_service_price,final_service_price=v.final_service_price,
  visit_reminder_offset_minutes=v.visit_reminder_offset_minutes,pickup_ready_eta_minutes=v.pickup_ready_eta_minutes,updated_at=clock_timestamp() where id=a.id;
 if target.id is not null then perform public.pm_deposit_rebalance(target.id); end if;
 return (select to_jsonb(ap) from public.appointments ap where ap.id=a.id);
end $$;

-- Every new helper is server-only. No browser can use these RPCs to bypass tenant authorization.
do $acl$
declare f regprocedure;
begin
 for f in select oid::regprocedure from pg_proc where pronamespace='public'::regnamespace and proname like 'pm_deposit_%' loop
  execute format('revoke all on function %s from public,anon,authenticated',f);
  execute format('grant execute on function %s to service_role',f);
 end loop;
end $acl$;
commit;
