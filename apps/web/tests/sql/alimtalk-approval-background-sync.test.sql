-- Run only in a disposable local database after the approval migrations.
begin;
insert into public.shops(id) values('approval-fixture-a'),('approval-fixture-b');
do $$
declare first_run uuid := gen_random_uuid(); second_run uuid := gen_random_uuid(); result jsonb; outcome boolean;
begin
  result := public.claim_alimtalk_approval_job(first_run);
  assert (result->>'acquired')::boolean, 'first worker must acquire lease';
  result := public.claim_alimtalk_approval_job(second_run);
  assert not (result->>'acquired')::boolean, 'second worker must not overlap';
  outcome := public.advance_alimtalk_approval_job(second_run,'foreign-cursor',true);
  assert not outcome, 'another worker cannot advance/release the lease';
  outcome := public.advance_alimtalk_approval_job(first_run,'approval-fixture-a',true);
  assert outcome, 'owner can checkpoint and release';
  result := public.claim_alimtalk_approval_job(second_run);
  assert result->>'afterShop'='approval-fixture-a', 'next worker must resume cursor';
  update public.alimtalk_approval_job set lease_until=clock_timestamp()-interval '1 second' where id;
  outcome := public.advance_alimtalk_approval_job(second_run,'stale',true);
  assert not outcome, 'expired worker cannot overwrite a newer cursor';
  result := public.claim_alimtalk_approval_job(first_run);
  assert (result->>'acquired')::boolean, 'expired lease is recoverable';
  assert not has_table_privilege('anon','public.alimtalk_approval_job','select');
  assert not has_table_privilege('authenticated','public.alimtalk_approval_job','update');
  assert not has_function_privilege('authenticated','public.claim_alimtalk_approval_job(uuid)','execute');
  assert has_function_privilege('service_role','public.claim_alimtalk_approval_job(uuid)','execute');
  assert (select relrowsecurity from pg_class where oid='public.alimtalk_approval_job'::regclass);
end $$;

update public.alimtalk_approval_job set lease_owner=null,lease_until=null where id;
set local role service_role;
do $$ declare result jsonb; run uuid := gen_random_uuid(); begin
  result := public.claim_alimtalk_approval_job(run);
  assert (result->>'acquired')::boolean, 'service role must be able to execute the real worker RPC';
  assert public.advance_alimtalk_approval_job(run,null,true), 'service role must be able to checkpoint';
end $$;
reset role;

-- Baseline first, then the approved owner submission. Repeated/re-approved snapshots deduplicate.
select public.observe_shop_alimtalk_approvals('approval-fixture-a',0,'[]');
select public.observe_shop_alimtalk_approvals('approval-fixture-a',1,'[{"alias":"grooming_started","code":"PM_FIXTURE","fingerprint":"approved-v1"}]');
select public.observe_shop_alimtalk_approvals('approval-fixture-a',2,'[{"alias":"grooming_started","code":"PM_FIXTURE","fingerprint":"approved-v1"}]');
do $$ begin
  assert (select count(*)=1 from public.shop_alimtalk_approval_notices where shop_id='approval-fixture-a');
  assert (select count(*)=0 from public.shop_alimtalk_approval_notices where shop_id='approval-fixture-b');
  begin
    perform public.observe_shop_alimtalk_approvals('approval-fixture-a',0,'[]');
    raise exception 'stale observation unexpectedly succeeded';
  exception when serialization_failure then null;
  end;
end $$;
select public.observe_shop_alimtalk_approvals('approval-fixture-a',3,'[{"alias":"grooming_started","code":"PM_FIXTURE","fingerprint":null}]');
do $$ begin
  assert (select observed->>'grooming_started:PM_FIXTURE' is null from public.shop_alimtalk_approval_sync where shop_id='approval-fixture-a'), 'revocation must hide approval';
end $$;
select public.observe_shop_alimtalk_approvals('approval-fixture-a',4,'[]');
do $$ begin
  assert (select observed='{}'::jsonb from public.shop_alimtalk_approval_sync where shop_id='approval-fixture-a'), 'removed template must leave no active observation';
end $$;
rollback;
