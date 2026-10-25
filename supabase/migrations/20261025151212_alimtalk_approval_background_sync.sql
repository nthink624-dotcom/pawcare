-- Durable worker cursor and lease. Server-only; no customer data or sending capability.
begin;
create table public.alimtalk_approval_job (
  id boolean primary key default true check (id),
  after_shop text,
  lease_owner uuid,
  lease_until timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.alimtalk_approval_job enable row level security;
revoke all on public.alimtalk_approval_job from public,anon,authenticated;
grant select,insert,update on public.alimtalk_approval_job to service_role;

create function public.claim_alimtalk_approval_job(p_run uuid)
returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare job public.alimtalk_approval_job%rowtype;
begin
  if p_run is null then raise exception 'PM_INVALID_JOB'; end if;
  insert into public.alimtalk_approval_job(id) values(true) on conflict do nothing;
  select * into job from public.alimtalk_approval_job where id for update;
  if job.lease_until > clock_timestamp() then return jsonb_build_object('acquired',false); end if;
  update public.alimtalk_approval_job set lease_owner=p_run,lease_until=clock_timestamp()+interval '330 seconds',updated_at=clock_timestamp() where id;
  return jsonb_build_object('acquired',true,'afterShop',job.after_shop);
end $$;

create function public.advance_alimtalk_approval_job(p_run uuid,p_after text,p_release boolean)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  update public.alimtalk_approval_job set after_shop=p_after,
    lease_owner=case when p_release then null else p_run end,
    lease_until=case when p_release then null else clock_timestamp()+interval '330 seconds' end,
    updated_at=clock_timestamp()
    where id and lease_owner=p_run and lease_until>clock_timestamp();
  return found;
end $$;
revoke all on function public.claim_alimtalk_approval_job(uuid) from public,anon,authenticated;
revoke all on function public.advance_alimtalk_approval_job(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.claim_alimtalk_approval_job(uuid),public.advance_alimtalk_approval_job(uuid,text,boolean) to service_role;

-- Persist the exact latest observation, including revocation/removal. Existing notices remain as history.
create or replace function public.observe_shop_alimtalk_approvals(p_shop text,p_expected_version bigint,p_snapshot jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cursor_row public.shop_alimtalk_approval_sync%rowtype; item jsonb; item_key text; revision text; next_observed jsonb := '{}';
begin
  if jsonb_typeof(p_snapshot) is distinct from 'array' then raise exception 'PM_INVALID_TEMPLATE_SNAPSHOT'; end if;
  insert into public.shop_alimtalk_approval_sync(shop_id) values(p_shop) on conflict do nothing;
  select * into cursor_row from public.shop_alimtalk_approval_sync where shop_id=p_shop for update;
  if cursor_row.version is distinct from p_expected_version then raise exception 'PM_TEMPLATE_OBSERVATION_CHANGED' using errcode='40001'; end if;
  for item in select value from jsonb_array_elements(p_snapshot) loop
    if nullif(item->>'alias','') is null or nullif(item->>'code','') is null then raise exception 'PM_INVALID_TEMPLATE_IDENTITY'; end if;
    item_key := (item->>'alias')||':'||(item->>'code');
    revision := nullif(item->>'fingerprint','');
    if revision is not null and cursor_row.observed->>item_key is distinct from revision and cursor_row.version>0 then
      insert into public.shop_alimtalk_approval_notices(shop_id,template_alias,template_code,fingerprint)
        values(p_shop,item->>'alias',item->>'code',revision) on conflict do nothing;
    end if;
    next_observed := jsonb_set(next_observed,array[item_key],coalesce(to_jsonb(revision),'null'::jsonb),true);
  end loop;
  update public.shop_alimtalk_approval_sync set observed=next_observed,version=version+1,checked_at=clock_timestamp() where shop_id=p_shop;
end $$;
notify pgrst,'reload schema';
commit;
