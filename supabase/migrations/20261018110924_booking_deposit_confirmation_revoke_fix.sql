-- Only the previously agreed confirmation correction/cancellation contract.
-- No table, column, policy, scheduled job, or existing booking backfill.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

-- Audit IDs are identity/bigint and account actions already serialize under the
-- guardian advisory lock + account row lock. A report/name edit is not an owner
-- decision to clear a revoked confirmation. Do not mutate policy snapshots.
create function public.pm_deposit_confirmation_review_required(p_account uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select coalesce((select e.action='revoke' from public.booking_deposit_events e
  where e.account_id=p_account and e.action in ('revoke','confirm','correct','retry','waive')
  order by e.id desc limit 1),false)
$$;
revoke all on function public.pm_deposit_confirmation_review_required(uuid) from public,anon,authenticated;
grant execute on function public.pm_deposit_confirmation_review_required(uuid) to service_role;

do $patch$
declare src text;
begin
 select pg_get_functiondef('public.pm_deposit_act(text,uuid,text,text,text,integer,text,text,integer)'::regprocedure) into src;
 if position('input_total:=p_amount;' in src)=0 or position('perform public.pm_deposit_rebalance(d.id);' in src)=0
  or position('pm_deposit_confirmation_review_required' in src)>0 then raise exception 'UNEXPECTED_DEPOSIT_ACTION_SOURCE'; end if;
 src:=replace(src,'deadline timestamptz;','deadline timestamptz; confirmation_review boolean;');
 src:=replace(src,'old_total:=d.received_total; old_refund:=d.refunded_total;',
  'old_total:=d.received_total; old_refund:=d.refunded_total; confirmation_review:=public.pm_deposit_confirmation_review_required(d.id);');
 src:=replace(src,'d.report_valid:=true; d.state:=''reported'';',
  'd.report_valid:=true; d.state:=case when confirmation_review then ''pending'' else ''reported'' end;');
 src:=replace(src,$old$elsif p_action in ('confirm','correct') then$old$,$new$elsif p_action='revoke' then
  if length(trim(p_note))=0 then raise exception 'DEPOSIT_REASON_REQUIRED'; end if;
  if a.status not in ('pending','confirmed') or d.state='cancelled' or public.pm_deposit_receipt_total(d.id)<=0
    or d.used_total>0 or d.refunded_total>0 or d.forfeited_total>0
    or d.received_total<>public.pm_deposit_receipt_total(d.id)
    or exists(select 1 from public.booking_deposit_events where account_id=d.id
      and action in ('carry_in','carry_out','date_moved_in','date_moved_out') and coalesce((details->>'amount')::bigint,0)>0)
    or exists(select 1 from public.booking_deposit_links li join public.appointments ap on ap.id=li.appointment_id
      where li.account_id=d.id and ap.status in ('in_progress','almost_done','completed'))
   then raise exception 'DEPOSIT_MANUAL_SETTLEMENT_REQUIRED'; end if;
  -- This is a correction of the owner's confirmation, NOT a refund, false
  -- customer report, or an assertion that no bank payment actually exists.
  d.received_total:=0; d.refund_due:=0; d.confirmed_at:=null; d.state:='pending'; input_total:=0;
 elsif p_action in ('confirm','correct') then$new$);
 src:=replace(src,'input_total:=p_amount;',$new$input_total:=p_amount;
  if confirmation_review and coalesce(p_amount,0)<=0 then raise exception 'DEPOSIT_RECONFIRM_AMOUNT_REQUIRED'; end if;$new$);
 src:=replace(src,'perform public.pm_deposit_rebalance(d.id);',$new$perform public.pm_deposit_rebalance(d.id);
 if p_action='revoke' then
  update public.booking_deposit_links set auto_confirmed_unverified=false where account_id=d.id;
  for target in select ap.id from public.appointments ap join public.booking_deposit_links li on li.appointment_id=ap.id
   where li.account_id=d.id and li.requires_deposit and ap.status='confirmed' order by ap.id for update of ap
  loop update public.appointments set status='pending',updated_at=clock_timestamp() where id=target.id; end loop;
  update public.booking_deposit_outbox set state='blocked',reason='입금 확인 취소로 보류',processed_at=clock_timestamp()
   where account_id=d.id and state='pending' and purpose in ('request','confirmed');
 end if;$new$);
 execute src;

 select pg_get_functiondef('public.pm_deposit_tick(text,timestamp with time zone)'::regprocedure) into src;
 if position('loop'||chr(10)||'  if d.state=' in src)=0 then raise exception 'UNEXPECTED_DEPOSIT_TICK_SOURCE'; end if;
 src:=replace(src,'loop'||chr(10)||'  if d.state=',
  'loop'||chr(10)||'  if public.pm_deposit_confirmation_review_required(d.id) then continue; end if;'||chr(10)||'  if d.state=');
 execute src;

 select pg_get_functiondef('public.pm_deposit_view(text,uuid)'::regprocedure) into src;
 if position('''reviewRemindedAt'',d.review_reminded_at' in src)=0 then raise exception 'UNEXPECTED_DEPOSIT_VIEW_SOURCE'; end if;
 src:=replace(src,'''reviewRemindedAt'',d.review_reminded_at',
  '''confirmationReviewRequired'',public.pm_deposit_confirmation_review_required(d.id),''reviewRemindedAt'',d.review_reminded_at');
 execute src;
end $patch$;
commit;
