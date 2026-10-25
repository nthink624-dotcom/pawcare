begin;
create table public.shop_alimtalk_approval_sync (
  shop_id text primary key references public.shops(id) on delete cascade,
  version bigint not null default 0,
  observed jsonb not null default '{}' check (jsonb_typeof(observed)='object'),
  checked_at timestamptz not null default clock_timestamp()
);
create table public.shop_alimtalk_approval_notices (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  template_alias text not null,
  template_code text not null,
  fingerprint text not null,
  created_at timestamptz not null default clock_timestamp(),
  read_by uuid[] not null default '{}',
  unique(shop_id,template_alias,template_code,fingerprint)
);
create index shop_alimtalk_approval_notices_shop_created_idx on public.shop_alimtalk_approval_notices(shop_id,created_at desc);
alter table public.shop_alimtalk_approval_sync enable row level security;
alter table public.shop_alimtalk_approval_notices enable row level security;
revoke all on public.shop_alimtalk_approval_sync,public.shop_alimtalk_approval_notices from public,anon,authenticated;
grant select,insert,update on public.shop_alimtalk_approval_sync,public.shop_alimtalk_approval_notices to service_role;

create function public.observe_shop_alimtalk_approvals(p_shop text,p_expected_version bigint,p_snapshot jsonb)
returns void language plpgsql security invoker set search_path=pg_catalog,public as $$
declare cursor_row public.shop_alimtalk_approval_sync%rowtype; item jsonb; item_key text; revision text;
begin
  if jsonb_typeof(p_snapshot) is distinct from 'array' then raise exception 'PM_INVALID_TEMPLATE_SNAPSHOT'; end if;
  insert into public.shop_alimtalk_approval_sync(shop_id) values(p_shop) on conflict do nothing;
  select * into cursor_row from public.shop_alimtalk_approval_sync where shop_id=p_shop for update;
  if cursor_row.version is distinct from p_expected_version then raise exception 'PM_TEMPLATE_OBSERVATION_CHANGED' using errcode='40001'; end if;
  for item in select value from jsonb_array_elements(p_snapshot) loop
    if nullif(item->>'alias','') is null or nullif(item->>'code','') is null then raise exception 'PM_INVALID_TEMPLATE_IDENTITY'; end if;
    item_key := (item->>'alias')||':'||(item->>'code');
    revision := nullif(item->>'fingerprint','');
    if revision is not null and cursor_row.observed->>item_key is distinct from revision then
      if cursor_row.version > 0 then
        insert into public.shop_alimtalk_approval_notices(shop_id,template_alias,template_code,fingerprint)
          values(p_shop,item->>'alias',item->>'code',revision) on conflict do nothing;
      end if;
      cursor_row.observed := jsonb_set(cursor_row.observed,array[item_key],to_jsonb(revision),true);
    elsif not cursor_row.observed ? item_key then
      cursor_row.observed := jsonb_set(cursor_row.observed,array[item_key],'null'::jsonb,true);
    end if;
  end loop;
  update public.shop_alimtalk_approval_sync set observed=cursor_row.observed,version=version+1,checked_at=clock_timestamp() where shop_id=p_shop;
end $$;

create function public.read_shop_alimtalk_approval(p_shop text,p_user uuid,p_notice uuid)
returns boolean language plpgsql security invoker set search_path=pg_catalog,public as $$
begin
  if p_user is null then raise exception 'PM_USER_REQUIRED'; end if;
  update public.shop_alimtalk_approval_notices set read_by=case when p_user=any(read_by) then read_by else array_append(read_by,p_user) end
    where id=p_notice and shop_id=p_shop;
  return found;
end $$;
revoke all on function public.observe_shop_alimtalk_approvals(text,bigint,jsonb),public.read_shop_alimtalk_approval(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.observe_shop_alimtalk_approvals(text,bigint,jsonb),public.read_shop_alimtalk_approval(text,uuid,uuid) to service_role;
notify pgrst,'reload schema';
commit;
