-- Preserve actual bank-receipt totals separately from transferred account funding.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
create function public.pm_deposit_receipt_total(p_account uuid) returns integer
language sql security invoker set search_path='' as $$
 select (d.received_total-coalesce((select sum(case when action in ('carry_in','date_moved_in') then coalesce((details->>'amount')::bigint,0)
 when action in ('carry_out','date_moved_out') then -coalesce((details->>'amount')::bigint,0) else 0 end)
 from public.booking_deposit_events where account_id=d.id),0))::integer from public.booking_deposit_accounts d where d.id=p_account
$$;
do $patch$
declare src text;
begin
 select pg_get_functiondef('public.pm_deposit_act(text,uuid,text,text,text,integer,text,text,integer)'::regprocedure) into src;
 if position('old_total integer; old_refund integer;' in src)=0 then raise exception 'UNEXPECTED_RECEIPT_CONTRACT'; end if;
 src:=replace(src,'old_total integer; old_refund integer;','old_total integer; old_refund integer; input_total integer;');
 src:=replace(src,'elsif p_action in (''confirm'',''correct'') then','elsif p_action in (''confirm'',''correct'') then
  input_total:=p_amount;
  if p_amount is null or p_amount<0 or p_amount>10000000 then raise exception ''DEPOSIT_INVALID_RECEIPT_TOTAL''; end if;
  p_amount:=p_amount+d.received_total-public.pm_deposit_receipt_total(d.id);');
 src:=replace(src,'p_amount>10000000 or p_amount<d.used_total','p_amount<d.used_total');
 src:=replace(src,'''previousTotal'',old_total,','''receiptTotal'',input_total,''previousTotal'',old_total,'); execute src;
 select pg_get_functiondef('public.pm_deposit_view(text,uuid)'::regprocedure) into src;
 src:=replace(src,'''requestedAmount'',d.requested_amount,','''receiptTotal'',public.pm_deposit_receipt_total(d.id),''requestedAmount'',d.requested_amount,');execute src;
end $patch$;
revoke all on function public.pm_deposit_receipt_total(uuid) from public,anon,authenticated;
grant execute on function public.pm_deposit_receipt_total(uuid) to service_role;
commit;
