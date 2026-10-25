-- UI acknowledgement only: never updates deposits, links, events or appointments.
create table public.booking_deposit_notice_reads (
 account_id uuid not null references public.booking_deposit_accounts(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 notice_key text not null check (length(notice_key) between 1 and 180),
 read_at timestamptz not null default now(),
 primary key (account_id,user_id,notice_key)
);
create index booking_deposit_notice_reads_user_idx on public.booking_deposit_notice_reads(user_id,account_id);
alter table public.booking_deposit_notice_reads enable row level security;
revoke all on public.booking_deposit_notice_reads from public,anon,authenticated;
grant select,insert,delete on public.booking_deposit_notice_reads to service_role;

-- Identical monetary projection without history aggregation. Preserve existing full
-- view and callers; no state, scheduling or settlement policy is changed.
do $migration$
declare src text; history_expr text := $expr$'history',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'action',e.action,'at',e.created_at,'details',e.details) order by e.id) from public.booking_deposit_events e where e.account_id=d.id),'[]')$expr$;
begin
 select pg_get_functiondef('public.pm_deposit_view(text,uuid)'::regprocedure) into src;
 if strpos(src,history_expr)=0 or strpos(src,'confirmationReviewRequired')=0 then raise exception 'UNEXPECTED_DEPOSIT_VIEW_CONTRACT'; end if;
 src:=replace(src,'public.pm_deposit_view(', 'public.pm_deposit_summary(');
 src:=replace(src,history_expr, $expr$'history','[]'::jsonb,'historyLoaded',false$expr$);
 execute src;
end $migration$;
revoke all on function public.pm_deposit_summary(text,uuid) from public,anon,authenticated;
grant execute on function public.pm_deposit_summary(text,uuid) to service_role;

create function public.pm_deposit_notices(p_shop text,p_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $function$
 select coalesce(jsonb_agg(n.payload order by n.urgent desc,n.booking_date,n.id),'[]'::jsonb)
 from (
  select d.id,d.booking_date,(d.refund_due=0 and d.review_reminded_at is not null) urgent,
   jsonb_build_object('accountId',d.id,'appointmentId',booking.appointment_id,'date',d.booking_date,
    'key',k.key,'kind',case when d.refund_due>0 then 'refund' else 'review' end,
    'amount',case when d.refund_due>0 then d.refund_due else d.requested_amount end,
    'guardianName',g.name,'payerName',d.payer_name,
    'urgent',d.refund_due=0 and d.review_reminded_at is not null) payload
  from public.booking_deposit_accounts d
  join public.guardians g on g.id=d.guardian_id and g.shop_id=d.shop_id
  cross join lateral (select l.appointment_id from public.booking_deposit_links l
   join public.appointments a on a.id=l.appointment_id and a.shop_id=d.shop_id
   where l.account_id=d.id order by (a.status not in ('cancelled','noshow')) desc,a.start_at,l.appointment_id limit 1) booking
  cross join lateral (select case when d.refund_due>0 then
   'refund:'||d.refund_due::text||':'||coalesce(d.cancellation_assessed_at::text,'')||':'||coalesce((select max(e.id)::text from public.booking_deposit_events e where e.account_id=d.id and e.action in ('cancellation_assessed','refund','service_price_corrected','correct','confirm','noshow_corrected')),'')
   else 'review:'||coalesce(d.reported_at::text,'')||':'||coalesce(d.review_reminded_at::text,'') end key) k
  where d.shop_id=p_shop and (d.refund_due>0 or d.state='reported')
   and not exists (select 1 from public.booking_deposit_notice_reads r where r.account_id=d.id and r.user_id=p_user and r.notice_key=k.key)
 ) n;
$function$;
revoke all on function public.pm_deposit_notices(text,uuid) from public,anon,authenticated;
grant execute on function public.pm_deposit_notices(text,uuid) to service_role;
