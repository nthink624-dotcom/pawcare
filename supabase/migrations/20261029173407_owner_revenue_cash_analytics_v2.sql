-- Cash facts are append-only and separate from service completion. Existing prices,
-- paid statuses and refund fields are preserved; no historical payment is invented.
alter table public.shop_revenue_entries add column cash_review_required boolean not null default true;
create unique index shop_revenue_entries_shop_id_id_v2 on public.shop_revenue_entries(shop_id,id);

create table public.shop_revenue_cash_requests (
  id uuid primary key,
  shop_id text not null references public.shops(id),
  actor_user_id uuid not null references auth.users(id),
  fingerprint text not null,
  created_at timestamptz not null default now()
);
create table public.shop_revenue_cash_events (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null,
  entry_id uuid not null,
  request_id uuid not null references public.shop_revenue_cash_requests(id),
  position integer not null,
  event_type text not null check(event_type in ('payment','refund')),
  payment_event_id uuid references public.shop_revenue_cash_events(id),
  amount integer not null check(amount > 0),
  discount_amount integer not null default 0 check(discount_amount >= 0),
  payment_method text not null check(payment_method in ('card','cash','transfer','easy_pay','other','unknown')),
  occurred_at timestamptz not null,
  actor_user_id uuid not null references auth.users(id),
  title_snapshot text not null,
  staff_id_snapshot text,
  staff_name_snapshot text not null,
  created_xid xid8 not null default pg_current_xact_id(),
  created_at timestamptz not null default now(),
  foreign key(shop_id,entry_id) references public.shop_revenue_entries(shop_id,id),
  unique(request_id,position),
  check((event_type='payment' and payment_event_id is null) or (event_type='refund' and payment_event_id is not null and discount_amount=0))
);
create index revenue_cash_shop_date_v2 on public.shop_revenue_cash_events(shop_id,occurred_at,id);
create index revenue_cash_shop_cash_date_v2 on public.shop_revenue_cash_events(shop_id,((occurred_at at time zone 'Asia/Seoul')::date));
create index revenue_cash_entry_v2 on public.shop_revenue_cash_events(shop_id,entry_id);
create index revenue_cash_refund_parent_v2 on public.shop_revenue_cash_events(payment_event_id) where payment_event_id is not null;
alter table public.shop_revenue_cash_requests enable row level security;
alter table public.shop_revenue_cash_events enable row level security;
revoke all on public.shop_revenue_cash_requests,public.shop_revenue_cash_events from public,anon,authenticated;
revoke all on public.shop_revenue_cash_requests,public.shop_revenue_cash_events from service_role;
grant select,insert on public.shop_revenue_cash_requests,public.shop_revenue_cash_events to service_role;
grant usage on schema private to service_role;
grant select on private.owner_account_deletion_requests to service_role;

create function public.record_owner_revenue_cash_v2(
  p_shop_id text,p_actor_user_id uuid,p_request_id uuid,p_entry_id uuid,
  p_event_type text,p_occurred_at timestamptz,p_tenders jsonb,p_payment_event_id uuid default null
) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
  entry public.shop_revenue_entries%rowtype;
  original public.shop_revenue_cash_events%rowtype;
  request public.shop_revenue_cash_requests%rowtype;
  fingerprint text;
  tender jsonb;
  due bigint;
  received bigint;
  returned bigint;
  incoming bigint;
  previous_discount bigint;
  allocated_discount bigint;
  item_discount integer;
  tender_amount integer;
  pos integer:=0;
  staff_id text;
  staff_name text;
  lock_user_id uuid;
begin
  if p_actor_user_id is null or not (
    exists(select 1 from public.shops s where s.id=p_shop_id and s.owner_user_id=p_actor_user_id and s.deleted_at is null)
    or exists(select 1 from public.owner_shop_memberships m join public.shops s on s.id=m.shop_id where m.shop_id=p_shop_id and m.owner_user_id=p_actor_user_id and m.role in ('owner','manager') and s.deleted_at is null)
  ) then raise exception 'REVENUE_ACCESS_DENIED' using errcode='42501'; end if;
  -- Serialize with the existing terminal account-deletion claim before any cash write.
  for lock_user_id in select distinct id from (select p_actor_user_id as id union all select owner_user_id from public.shops where id=p_shop_id) owners where id is not null order by id loop
    perform pg_advisory_xact_lock(hashtextextended(lock_user_id::text,891271));
  end loop;
  if exists(select 1 from private.owner_account_deletion_requests d where d.owner_user_id in (p_actor_user_id,(select owner_user_id from public.shops where id=p_shop_id)) and d.state in ('prepared','data_purged')) then
    raise exception 'REVENUE_ACCOUNT_DELETION_PENDING' using errcode='55000'; end if;
  if p_event_type is null or p_request_id is null or p_entry_id is null or p_tenders is null or p_event_type not in ('payment','refund') or p_occurred_at is null or p_occurred_at>now()+interval '1 minute'
    or p_occurred_at<'2000-01-01'::timestamptz or jsonb_typeof(p_tenders)<>'array'
    or jsonb_array_length(p_tenders) not between 1 and 6 then
    raise exception 'REVENUE_INVALID_INPUT' using errcode='22023';
  end if;
  select * into entry from public.shop_revenue_entries r where r.shop_id=p_shop_id and r.id=p_entry_id for update;
  if not found then raise exception 'REVENUE_ENTRY_NOT_FOUND' using errcode='P0002'; end if;
  if entry.status in ('cancelled','void') or entry.revenue_type in ('refund','discount') then
    raise exception 'REVENUE_ENTRY_NOT_COLLECTIBLE' using errcode='22023'; end if;
  fingerprint:=jsonb_build_object('entryId',p_entry_id,'type',p_event_type,'at',p_occurred_at,'tenders',p_tenders,'paymentEventId',p_payment_event_id)::text;
  select * into request from public.shop_revenue_cash_requests where id=p_request_id;
  if found then
    if request.shop_id<>p_shop_id or request.actor_user_id<>p_actor_user_id or request.fingerprint<>fingerprint then
      raise exception 'REVENUE_REQUEST_CONFLICT' using errcode='23505'; end if;
    return jsonb_build_object('requestId',p_request_id,'reused',true);
  end if;
  incoming:=0;
  for tender in select value from jsonb_array_elements(p_tenders) loop
    if coalesce(tender->>'method','') not in ('card','cash','transfer','easy_pay','other','unknown')
      or jsonb_typeof(tender->'amount')<>'number' or coalesce(tender->>'amount','')!~'^[1-9][0-9]{0,8}$' then
      raise exception 'REVENUE_INVALID_TENDER' using errcode='22023'; end if;
    incoming:=incoming+(tender->>'amount')::bigint;
  end loop;
  due:=greatest(entry.gross_amount::bigint-entry.discount_amount-entry.refund_amount,0);
  select coalesce(sum(amount) filter(where event_type='payment'),0),coalesce(sum(amount) filter(where event_type='refund'),0),
    coalesce(sum(discount_amount),0) into received,returned,previous_discount
    from public.shop_revenue_cash_events where shop_id=p_shop_id and entry_id=p_entry_id;
  if p_event_type='payment' then
    if p_payment_event_id is not null or incoming>due-received then
      raise exception 'REVENUE_PAYMENT_EXCEEDS_DUE' using errcode='22023'; end if;
  else
    if jsonb_array_length(p_tenders)<>1 then raise exception 'REVENUE_REFUND_SINGLE_SOURCE' using errcode='22023'; end if;
    select * into original from public.shop_revenue_cash_events where id=p_payment_event_id and shop_id=p_shop_id and entry_id=p_entry_id and event_type='payment';
    if not found then raise exception 'REVENUE_PAYMENT_NOT_FOUND' using errcode='P0002'; end if;
    if p_occurred_at<original.occurred_at or p_tenders->0->>'method'<>original.payment_method or incoming>original.amount-(select coalesce(sum(amount),0) from public.shop_revenue_cash_events where payment_event_id=original.id) then
      raise exception 'REVENUE_REFUND_EXCEEDS_PAYMENT' using errcode='22023'; end if;
  end if;
  select coalesce(g.staff_id,a.staff_id),coalesce(nullif(s.display_name,''),s.name,'담당 미지정') into staff_id,staff_name
    from public.shop_revenue_entries r
    left join public.grooming_records g on g.id=r.grooming_record_id and g.shop_id=r.shop_id
    left join public.appointments a on a.id=r.appointment_id and a.shop_id=r.shop_id
    left join public.staff_members s on s.id=coalesce(g.staff_id,a.staff_id) and s.shop_id=r.shop_id
    where r.id=p_entry_id and r.shop_id=p_shop_id;
  if p_event_type='refund' then
    staff_id:=original.staff_id_snapshot;
    staff_name:=original.staff_name_snapshot;
  end if;
  insert into public.shop_revenue_cash_requests(id,shop_id,actor_user_id,fingerprint) values(p_request_id,p_shop_id,p_actor_user_id,fingerprint);
  allocated_discount:=previous_discount;
  for tender in select value from jsonb_array_elements(p_tenders) loop
    pos:=pos+1; tender_amount:=(tender->>'amount')::integer;
    item_discount:=case when p_event_type='payment' and due>0 then
      greatest(0,floor(entry.discount_amount::numeric*(received+tender_amount)/due)::bigint-allocated_discount)::integer else 0 end;
    insert into public.shop_revenue_cash_events(shop_id,entry_id,request_id,position,event_type,payment_event_id,amount,discount_amount,payment_method,occurred_at,actor_user_id,title_snapshot,staff_id_snapshot,staff_name_snapshot)
      values(p_shop_id,p_entry_id,p_request_id,pos,p_event_type,p_payment_event_id,tender_amount,item_discount,tender->>'method',p_occurred_at,p_actor_user_id,case when p_event_type='refund' then original.title_snapshot else coalesce(nullif(entry.title,''),'서비스') end,staff_id,coalesce(staff_name,'담당 미지정'));
    if p_event_type='payment' then received:=received+tender_amount; allocated_discount:=allocated_discount+item_discount; else returned:=returned+tender_amount; end if;
  end loop;
  update public.shop_revenue_entries set cash_review_required=false,
    status=case when returned>=received and received>0 then 'refunded' when returned>0 then 'partially_refunded' when received>=due then 'paid' else 'unpaid' end,
    payment_method=case when (select count(distinct payment_method) from public.shop_revenue_cash_events where entry_id=p_entry_id and shop_id=p_shop_id and event_type='payment')>1 then 'mixed' else p_tenders->0->>'method' end,
    updated_at=now() where id=p_entry_id and shop_id=p_shop_id;
  return jsonb_build_object('requestId',p_request_id,'reused',false);
end;
$$;
revoke all on function public.record_owner_revenue_cash_v2(text,uuid,uuid,uuid,text,timestamptz,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.record_owner_revenue_cash_v2(text,uuid,uuid,uuid,text,timestamptz,jsonb,uuid) to service_role;

-- Tenant-bound projections. Client roles cannot read the views or their underlying rows.
create view public.owner_revenue_cash_detail_v2 with(security_invoker=true) as
select c.*, (c.occurred_at at time zone 'Asia/Seoul')::date as cash_date,
  case when c.event_type='refund' then -c.amount else c.amount end::bigint as signed_amount,
  r.appointment_id,r.entry_date as appointment_date,g.name as guardian_name,p.name as pet_name,
  case when c.event_type='payment' then c.amount-(select coalesce(sum(x.amount),0) from public.shop_revenue_cash_events x where x.payment_event_id=c.id) else 0 end::bigint as refundable_amount
from public.shop_revenue_cash_events c join public.shop_revenue_entries r on r.id=c.entry_id and r.shop_id=c.shop_id
left join public.guardians g on g.id=r.guardian_id and g.shop_id=r.shop_id
left join public.pets p on p.id=r.pet_id and p.shop_id=r.shop_id;
create view public.owner_revenue_outstanding_v2 with(security_invoker=true) as
select r.*,coalesce(g.staff_id,a.staff_id) as staff_id,coalesce(nullif(s.display_name,''),s.name,'담당 미지정') as staff_name,
  gu.name as guardian_name,p.name as pet_name,
  greatest(r.gross_amount::bigint-r.discount_amount-r.refund_amount-coalesce(pay.received,0),0) as outstanding_amount
from public.shop_revenue_entries r
left join lateral(select sum(c.amount) as received from public.shop_revenue_cash_events c where c.shop_id=r.shop_id and c.entry_id=r.id and c.event_type='payment') pay on true
left join public.grooming_records g on g.id=r.grooming_record_id and g.shop_id=r.shop_id
left join public.appointments a on a.id=r.appointment_id and a.shop_id=r.shop_id
left join public.staff_members s on s.id=coalesce(g.staff_id,a.staff_id) and s.shop_id=r.shop_id
left join public.guardians gu on gu.id=r.guardian_id and gu.shop_id=r.shop_id
left join public.pets p on p.id=r.pet_id and p.shop_id=r.shop_id
where r.status not in ('cancelled','void') and r.revenue_type not in ('refund','discount');
revoke all on public.owner_revenue_cash_detail_v2,public.owner_revenue_outstanding_v2 from public,anon,authenticated;
grant select on public.owner_revenue_cash_detail_v2,public.owner_revenue_outstanding_v2 to service_role;

-- Mutable legacy debts cannot be reconstructed from old tuple versions. A content
-- revision lets the API reject changed reports instead of exporting mixed amounts.
create function private.owner_revenue_outstanding_revision_v2(p_shop_id text,p_to date,p_staff_id text,p_snapshot_at timestamptz,p_cash_snapshot pg_snapshot)
returns text language sql stable security invoker set search_path='' as $$
with pending as (
 select r.id,r.entry_date,r.title,r.staff_id,r.staff_name,r.cash_review_required,
 greatest(r.gross_amount::bigint-r.discount_amount-r.refund_amount-(select coalesce(sum(c.amount),0) from public.shop_revenue_cash_events c where c.entry_id=r.id and c.shop_id=r.shop_id and c.event_type='payment' and c.created_at<=p_snapshot_at and pg_visible_in_snapshot(c.created_xid,p_cash_snapshot)),0) as amount
 from public.owner_revenue_outstanding_v2 r where r.shop_id=p_shop_id and r.created_at<=p_snapshot_at and r.entry_date<=p_to and (p_staff_id='' or coalesce(r.staff_id,'unassigned')=p_staff_id)
)
select md5(coalesce(string_agg(md5(jsonb_build_array(id,entry_date,title,staff_id,staff_name,cash_review_required,amount)::text),'' order by id),'')) from pending where amount>0;
$$;
revoke all on function private.owner_revenue_outstanding_revision_v2(text,date,text,timestamptz,pg_snapshot) from public,anon,authenticated;
grant execute on function private.owner_revenue_outstanding_revision_v2(text,date,text,timestamptz,pg_snapshot) to service_role;

create function public.owner_revenue_report_v2(p_shop_id text,p_from date,p_to date,p_previous_from date,p_previous_to date,p_staff_id text default '',p_method text default 'all',p_snapshot_at timestamptz default now(),p_cash_snapshot pg_snapshot default null)
returns jsonb language sql stable security invoker set search_path='' as $$
with facts as materialized (
 select * from public.owner_revenue_cash_detail_v2 c where c.shop_id=p_shop_id and c.created_at<=p_snapshot_at
 and pg_visible_in_snapshot(c.created_xid,coalesce(p_cash_snapshot,pg_current_snapshot()))
 and (c.cash_date between p_from and p_to or c.cash_date between p_previous_from and p_previous_to)
 and (p_staff_id='' or coalesce(c.staff_id_snapshot,'unassigned')=p_staff_id)
 and (p_method='all' or c.payment_method=p_method)
), current_facts as materialized(select * from facts where cash_date between p_from and p_to),
totals as (
 select part,jsonb_build_object('collectedAmount',coalesce(sum(amount) filter(where event_type='payment'),0),'refundAmount',coalesce(sum(amount) filter(where event_type='refund'),0),
 'netAmount',coalesce(sum(signed_amount),0),'discountAmount',coalesce(sum(discount_amount),0),'paidCount',count(distinct entry_id) filter(where event_type='payment'),'eventCount',count(id)) as value
 from (values('current'),('previous')) parts(part) left join facts on case when part='current' then cash_date between p_from and p_to else cash_date between p_previous_from and p_previous_to end group by part
), grouped as (
 select grouping.key,max(grouping.name) as name,grouping.kind,coalesce(sum(amount) filter(where event_type='payment'),0) as collected,coalesce(sum(amount) filter(where event_type='refund'),0) as refunded,sum(signed_amount) as net,count(distinct entry_id) as count
 from current_facts c cross join lateral(values(c.title_snapshot,c.title_snapshot,'category'),(coalesce(c.staff_id_snapshot,'unassigned'),c.staff_name_snapshot,'staff'),(c.payment_method,c.payment_method,'method')) grouping(key,name,kind)
 group by grouping.key,grouping.kind
), paid_entries as (
 select c.entry_id,sum(c.discount_amount) as allocated_discount from current_facts c where c.event_type='payment' group by c.entry_id
), benefit_facts as (
 select paid.entry_id,trim(coupon->>'name') as name,
   case when r.discount_amount>0 and coupon->>'discountAmount' ~ '^[0-9]{1,10}$' then floor(paid.allocated_discount::numeric*least((coupon->>'discountAmount')::numeric,r.discount_amount)/r.discount_amount) else 0 end as discount_amount,
   (coupon->>'discountType'='service' or nullif(coupon->>'serviceBenefitName','') is not null) as free_service
 from paid_entries paid join public.shop_revenue_entries r on r.id=paid.entry_id and r.shop_id=p_shop_id
 join public.appointments a on a.id=r.appointment_id and a.shop_id=r.shop_id
 cross join lateral jsonb_array_elements(case when jsonb_typeof(a.discount_snapshot->'appliedCoupons')='array' then a.discount_snapshot->'appliedCoupons' else coalesce((select jsonb_agg(jsonb_build_object('name',n)) from unnest(a.discount_coupon_names) n),'[]'::jsonb) end) coupon
 where coalesce(trim(coupon->>'name'),'')<>''
), pending_snapshot as (
 select r.*,greatest(r.gross_amount::bigint-r.discount_amount-r.refund_amount-(select coalesce(sum(c.amount),0) from public.shop_revenue_cash_events c where c.entry_id=r.id and c.shop_id=r.shop_id and c.event_type='payment' and c.created_at<=p_snapshot_at and pg_visible_in_snapshot(c.created_xid,coalesce(p_cash_snapshot,pg_current_snapshot()))),0) as snapshot_outstanding
 from public.owner_revenue_outstanding_v2 r where r.shop_id=p_shop_id and r.created_at<=p_snapshot_at and r.entry_date<=p_to and (p_staff_id='' or coalesce(r.staff_id,'unassigned')=p_staff_id)
), pending as (
 select * from pending_snapshot where snapshot_outstanding>0
)
select jsonb_build_object(
 'cashSnapshot',coalesce(p_cash_snapshot,pg_current_snapshot())::text,
 'outstandingRevision',private.owner_revenue_outstanding_revision_v2(p_shop_id,p_to,p_staff_id,p_snapshot_at,coalesce(p_cash_snapshot,pg_current_snapshot())),
 'summary',(select value from totals where part='current'),'previous',(select value from totals where part='previous'),
 'daily',coalesce((select jsonb_agg(jsonb_build_object('date',cash_date,'collectedAmount',collected,'refundAmount',refunded,'netAmount',net) order by cash_date) from(select cash_date,coalesce(sum(amount) filter(where event_type='payment'),0) collected,coalesce(sum(amount) filter(where event_type='refund'),0) refunded,sum(signed_amount) net from current_facts group by cash_date) d),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('key',key,'name',name,'collectedAmount',collected,'refundAmount',refunded,'netAmount',net,'count',count) order by net desc,key) from grouped where kind='category'),'[]'::jsonb),
 'staff',coalesce((select jsonb_agg(jsonb_build_object('key',key,'name',name,'collectedAmount',collected,'refundAmount',refunded,'netAmount',net,'count',count) order by net desc,key) from grouped where kind='staff'),'[]'::jsonb),
 'paymentMethods',coalesce((select jsonb_agg(jsonb_build_object('key',key,'name',name,'collectedAmount',collected,'refundAmount',refunded,'netAmount',net,'count',count) order by net desc,key) from grouped where kind='method'),'[]'::jsonb),
 'benefits',coalesce((select jsonb_agg(jsonb_build_object('name',name,'usageCount',usage_count,'discountAmount',discount_amount,'freeServiceCount',free_count) order by name) from(select name,count(distinct entry_id) as usage_count,sum(discount_amount) as discount_amount,count(distinct entry_id) filter(where free_service) as free_count from benefit_facts group by name) b),'[]'::jsonb),
 'outstanding',jsonb_build_object('amount',coalesce((select sum(snapshot_outstanding) from pending),0),'count',(select count(*) from pending),'reviewRequiredCount',(select count(*) from pending where cash_review_required),'through',p_to),
 'staffOptions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from (
 select distinct on(id) id,name from (
 select s.id,coalesce(nullif(s.display_name,''),s.name) as name,0 as priority from public.staff_members s where s.shop_id=p_shop_id
 union all select coalesce(c.staff_id_snapshot,'unassigned'),c.staff_name_snapshot,1 from public.shop_revenue_cash_events c where c.shop_id=p_shop_id
 union all select 'unassigned','담당 미지정',2) staff order by id,priority,name) options),'[]'::jsonb)
);
$$;

create function public.owner_revenue_transactions_v2(p_shop_id text,p_from date,p_to date,p_staff_id text default '',p_method text default 'all',p_view text default 'payments',p_page integer default 1,p_page_size integer default 25,p_date date default null,p_snapshot_at timestamptz default now(),p_event_type text default '',p_cash_snapshot pg_snapshot default null)
returns jsonb language sql stable security invoker set search_path='' as $$
with pending as (
 select r.*,greatest(r.gross_amount::bigint-r.discount_amount-r.refund_amount-(select coalesce(sum(c.amount),0) from public.shop_revenue_cash_events c where c.entry_id=r.id and c.shop_id=r.shop_id and c.event_type='payment' and c.created_at<=p_snapshot_at and pg_visible_in_snapshot(c.created_xid,coalesce(p_cash_snapshot,pg_current_snapshot()))),0) as snapshot_outstanding
 from public.owner_revenue_outstanding_v2 r where r.shop_id=p_shop_id and r.created_at<=p_snapshot_at and r.entry_date<=p_to and (p_staff_id='' or coalesce(r.staff_id,'unassigned')=p_staff_id)
), rows as (
 select c.id,c.entry_id,c.appointment_id,c.appointment_date,c.occurred_at,c.title_snapshot as title,c.guardian_name,c.pet_name,c.staff_name_snapshot as staff_name,c.event_type,c.payment_method,c.signed_amount as amount,c.discount_amount,c.refundable_amount,false as confirmation_required
 from public.owner_revenue_cash_detail_v2 c where p_view='payments' and c.shop_id=p_shop_id and c.created_at<=p_snapshot_at and c.cash_date between p_from and p_to
 and pg_visible_in_snapshot(c.created_xid,coalesce(p_cash_snapshot,pg_current_snapshot()))
 and (p_event_type='' or c.event_type=p_event_type)
 and (p_date is null or c.cash_date=p_date) and (p_staff_id='' or coalesce(c.staff_id_snapshot,'unassigned')=p_staff_id) and (p_method='all' or c.payment_method=p_method)
 union all
 select r.id,r.id,r.appointment_id,r.entry_date,null::timestamptz,r.title,r.guardian_name,r.pet_name,r.staff_name,'outstanding','unknown',r.snapshot_outstanding,0,0,r.cash_review_required
 from pending r where p_view='outstanding' and r.snapshot_outstanding>0
), page as(select * from rows order by coalesce(occurred_at,appointment_date::timestamp at time zone 'Asia/Seoul') desc,id desc limit least(greatest(p_page_size,1),500) offset (greatest(p_page,1)-1)*least(greatest(p_page_size,1),500))
select jsonb_build_object('cashSnapshot',coalesce(p_cash_snapshot,pg_current_snapshot())::text,'outstandingRevision',private.owner_revenue_outstanding_revision_v2(p_shop_id,p_to,p_staff_id,p_snapshot_at,coalesce(p_cash_snapshot,pg_current_snapshot())),'total',(select count(*) from rows),'transactions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'entryId',entry_id,'appointmentId',appointment_id,'appointmentDate',appointment_date,'occurredAt',occurred_at,'title',title,'guardianName',guardian_name,'petName',pet_name,'staffName',staff_name,'eventType',event_type,'paymentMethod',payment_method,'amount',amount,'discountAmount',discount_amount,'refundableAmount',refundable_amount,'confirmationRequired',confirmation_required) order by coalesce(occurred_at,appointment_date::timestamp at time zone 'Asia/Seoul') desc,id desc) from page),'[]'::jsonb));
$$;
revoke all on function public.owner_revenue_report_v2(text,date,date,date,date,text,text,timestamptz,pg_snapshot),public.owner_revenue_transactions_v2(text,date,date,text,text,text,integer,integer,date,timestamptz,text,pg_snapshot) from public,anon,authenticated;
grant execute on function public.owner_revenue_report_v2(text,date,date,date,date,text,text,timestamptz,pg_snapshot),public.owner_revenue_transactions_v2(text,date,date,text,text,text,integer,integer,date,timestamptz,text,pg_snapshot) to service_role;

-- Only newly completed work changes from inferred paid to unpaid. Old ledger rows
-- remain untouched. After first cash confirmation, preserve booked price snapshots.
create or replace function public.sync_grooming_record_revenue_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_title text;
  resolved_gross_amount integer;
  resolved_discount_amount integer;
begin
  select coalesce(nullif(new.service_name_snapshot, ''), nullif(services.name, ''), 'Grooming service')
    into service_title
    from public.services
   where services.id = new.service_id;

  service_title := coalesce(service_title, nullif(new.service_name_snapshot, ''), 'Grooming service');
  resolved_gross_amount := greatest(coalesce(new.original_price, new.price_paid + new.discount_amount), 0);
  resolved_discount_amount := least(greatest(new.discount_amount, 0), resolved_gross_amount);

  insert into public.shop_revenue_entries (
    shop_id,
    appointment_id,
    grooming_record_id,
    guardian_id,
    pet_id,
    service_id,
    entry_date,
    occurred_at,
    revenue_type,
    status,
    cash_review_required,
    payment_method,
    gross_amount,
    discount_amount,
    refund_amount,
    title,
    memo,
    source,
    metadata,
    created_at,
    updated_at
  ) values (
    new.shop_id,
    new.appointment_id,
    new.id,
    new.guardian_id,
    new.pet_id,
    new.service_id,
    (new.groomed_at at time zone 'Asia/Seoul')::date,
    new.groomed_at,
    'service',
    'unpaid',
    false,
    'unknown',
    resolved_gross_amount,
    resolved_discount_amount,
    0,
    service_title,
    coalesce(nullif(new.memo, ''), nullif(new.style_notes, ''), ''),
    'grooming_record',
    jsonb_strip_nulls(jsonb_build_object(
      'actualDurationMinutes', new.actual_duration_minutes,
      'expectedDurationMinutes', new.expected_duration_minutes,
      'nextRecommendedVisitDate', new.next_recommended_visit_date,
      'recordSource', new.record_source,
      'syncedFrom', 'grooming_records'
    )),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (grooming_record_id) where grooming_record_id is not null
  do update set
    appointment_id = excluded.appointment_id,
    guardian_id = excluded.guardian_id,
    pet_id = excluded.pet_id,
    service_id = excluded.service_id,
    entry_date = excluded.entry_date,
    occurred_at = excluded.occurred_at,
    gross_amount = case when exists(select 1 from public.shop_revenue_cash_events c where c.entry_id=shop_revenue_entries.id and c.shop_id=shop_revenue_entries.shop_id) then shop_revenue_entries.gross_amount else excluded.gross_amount end,
    discount_amount = case when exists(select 1 from public.shop_revenue_cash_events c where c.entry_id=shop_revenue_entries.id and c.shop_id=shop_revenue_entries.shop_id) then shop_revenue_entries.discount_amount else excluded.discount_amount end,
    title = excluded.title,
    memo = excluded.memo,
    metadata = coalesce(public.shop_revenue_entries.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;


-- Retention must be resolved before existing deletion code can touch media or rows.
create function private.guard_revenue_cash_account_deletion_v2()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.shop_revenue_cash_events c where c.shop_id=any(new.shop_ids) or c.actor_user_id=new.owner_user_id) then
    raise exception 'OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED' using errcode='P0001';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_revenue_cash_account_deletion_v2() from public,anon,authenticated;
create trigger owner_deletion_guard_cash_v2 before insert on private.owner_account_deletion_requests
for each row execute function private.guard_revenue_cash_account_deletion_v2();
revoke all on function public.sync_grooming_record_revenue_entry() from public,anon,authenticated;
grant execute on function public.sync_grooming_record_revenue_entry() to service_role;
