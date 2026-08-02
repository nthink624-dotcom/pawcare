create or replace function public.grant_shop_alimtalk_credits_once(
  p_shop_id text,
  p_amount integer,
  p_credit_bucket text,
  p_reason text,
  p_metadata jsonb,
  p_idempotency_key text
)
returns table (
  remaining_count integer,
  event_id uuid,
  already_processed boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_event public.shop_alimtalk_credit_events%rowtype;
  v_grant record;
begin
  if nullif(trim(p_idempotency_key), '') is null then
    raise exception 'idempotency key is required';
  end if;

  -- Serialize grants for the same payment without requiring cleanup of
  -- historical ledger rows before this migration can be applied.
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key, 0));

  select *
  into v_existing_event
  from public.shop_alimtalk_credit_events
  where shop_id = p_shop_id
    and event_type = 'grant'
    and credit_bucket = p_credit_bucket
    and reason = p_reason
    and metadata ->> 'paymentId' = p_idempotency_key
  order by created_at asc
  limit 1;

  if found then
    return query
    select
      v_existing_event.balance_after,
      v_existing_event.id,
      true;
    return;
  end if;

  select *
  into v_grant
  from public.grant_shop_alimtalk_credits(
    p_shop_id,
    p_amount,
    p_credit_bucket,
    p_reason,
    coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('paymentId', p_idempotency_key)
  );

  return query
  select
    v_grant.remaining_count,
    v_grant.event_id,
    false;
end;
$$;

revoke all on function public.grant_shop_alimtalk_credits_once(text, integer, text, text, jsonb, text) from public;
revoke all on function public.grant_shop_alimtalk_credits_once(text, integer, text, text, jsonb, text) from anon;
revoke all on function public.grant_shop_alimtalk_credits_once(text, integer, text, text, jsonb, text) from authenticated;
grant execute on function public.grant_shop_alimtalk_credits_once(text, integer, text, text, jsonb, text) to service_role;
