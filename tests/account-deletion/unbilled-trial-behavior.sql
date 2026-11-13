do $$ begin
  if current_database() <> 'pm_deletion_fixture' then raise exception 'Local fixture only'; end if;
end $$;
create temporary table fixture_results(name text, passed boolean);
do $$
declare
  c record; u uuid; k text; outcome text; req uuid; first_owner uuid; first_key text; first_req uuid;
  base jsonb := '{"subscription_status":"trialing","payment_method_exists":false,"last_payment_status":"none","trial_started_at":"2026-11-01T00:00:00Z","trial_ends_at":"2026-12-15T00:00:00Z"}';
begin
  for c in select * from (values
    ('unbilled trial', '{}'::jsonb, 'ok', ''),
    ('unbilled trial will end', '{"subscription_status":"trial_will_end"}'::jsonb, 'ok', ''),
    ('unknown payment method', '{"payment_method_exists":null}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('payment method present', '{"payment_method_exists":true}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('billing key present', '{"billing_key_encrypted":"fixture"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('billing encryption version', '{"billing_key_encryption_version":1}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('billing issue present', '{"billing_issue_id":"fixture"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('scheduled charge', '{"last_schedule_id":"fixture"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('next billing date', '{"next_billing_at":"2026-12-15T00:00:00Z"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('payment id present', '{"last_payment_id":"fixture"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('payment timestamp', '{"last_payment_at":"2026-11-01T00:00:00Z"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('failed payment timestamp', '{"last_payment_failed_at":"2026-11-01T00:00:00Z"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('paid period start', '{"current_period_started_at":"2026-11-01T00:00:00Z"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('paid period end', '{"current_period_ends_at":"2026-12-15T00:00:00Z"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('trial start missing', '{"trial_started_at":null}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('trial end missing', '{"trial_ends_at":null}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('paid status', '{"last_payment_status":"paid"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('unknown payment status', '{"last_payment_status":null}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('active subscription', '{"subscription_status":"active"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('past due subscription', '{"subscription_status":"past_due"}'::jsonb, 'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL', ''),
    ('cancelled unchanged', '{"subscription_status":"canceled"}'::jsonb, 'ok', ''),
    ('expired unchanged', '{"subscription_status":"expired"}'::jsonb, 'ok', ''),
    ('payment ledger retained', '{}'::jsonb, 'OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED', 'payment'),
    ('billing event retained', '{}'::jsonb, 'OWNER_ACCOUNT_DELETION_RETENTION_POLICY_REQUIRED', 'event')
  ) as v(name,patch,expected,evidence)
  loop
    u:=gen_random_uuid(); k:=md5(c.name)||md5(c.name); req:=null;
    insert into public.shops values ('fixture-'||u::text,u);
    insert into public.owner_subscriptions select * from jsonb_populate_record(null::public.owner_subscriptions,base||c.patch||jsonb_build_object('user_id',u));
    if c.evidence='payment' then insert into public.owner_payment_ledger values(u); end if;
    if c.evidence='event' then insert into public.owner_billing_events values(u); end if;
    begin
      select request_id into req from public.claim_owner_account_deletion_v1(u,k);
      outcome:='ok';
    exception when others then outcome:=sqlerrm;
    end;
    if outcome<>c.expected then raise exception 'Case %: expected %, got %',c.name,c.expected,outcome; end if;
    if c.expected<>'ok' and exists(select 1 from private.owner_account_deletion_requests where owner_user_id=u) then
      raise exception 'Rejected case % persisted a deletion request',c.name;
    end if;
    if c.name='unbilled trial' then first_owner:=u;first_key:=k;first_req:=req;end if;
    insert into fixture_results values(c.name,true);
  end loop;
  select request_id into req from public.claim_owner_account_deletion_v1(first_owner,first_key);
  if req is distinct from first_req or (select count(*) from private.owner_account_deletion_requests where owner_user_id=first_owner)<>1 then
    raise exception 'Idempotent request was duplicated';
  end if;
  insert into fixture_results values('idempotent request',true);
  begin perform public.claim_owner_account_deletion_v1(gen_random_uuid(),first_key); outcome:='unexpected';
  exception when others then outcome:=sqlerrm;end;
  if outcome<>'OWNER_ACCOUNT_DELETION_IDEMPOTENCY_CONFLICT' then raise exception 'Owner mismatch allowed';end if;
  insert into fixture_results values('owner mismatch rejected',true);
  begin perform public.claim_owner_account_deletion_v1(null,repeat('0',64)); outcome:='unexpected';
  exception when others then outcome:=sqlerrm;end;
  if outcome<>'OWNER_ACCOUNT_DELETION_INVALID_REQUEST' then raise exception 'Null owner allowed';end if;
  insert into fixture_results values('null owner rejected',true);
  begin perform public.claim_owner_account_deletion_v1(gen_random_uuid(),'not-a-hash'); outcome:='unexpected';
  exception when others then outcome:=sqlerrm;end;
  if outcome<>'OWNER_ACCOUNT_DELETION_INVALID_REQUEST' then raise exception 'Invalid hash allowed';end if;
  insert into fixture_results values('invalid idempotency hash rejected',true);
  begin perform public.claim_owner_account_deletion_v1(gen_random_uuid(),repeat('a',64)); outcome:='unexpected';
  exception when others then outcome:=sqlerrm;end;
  if outcome<>'OWNER_ACCOUNT_DELETION_OWNER_NOT_FOUND' then raise exception 'Shop ownership guard missing';end if;
  insert into fixture_results values('shop ownership required',true);
  if has_function_privilege('anon','public.claim_owner_account_deletion_v1(uuid,text)','EXECUTE')
    or has_function_privilege('authenticated','public.claim_owner_account_deletion_v1(uuid,text)','EXECUTE')
    or not has_function_privilege('service_role','public.claim_owner_account_deletion_v1(uuid,text)','EXECUTE') then
    raise exception 'Service role boundary changed';
  end if;
  insert into fixture_results values('service role only',true);
end $$;
select json_build_object('cases',count(*),'passed',count(*) filter(where passed),'failed',count(*) filter(where not passed)) from fixture_results;
