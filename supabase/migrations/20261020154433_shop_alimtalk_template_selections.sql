-- Owner selections are independent of platform defaults and review drafts.
begin;
create table public.shop_alimtalk_template_selections (
  shop_id text not null references public.shops(id) on delete cascade,
  template_alias text not null,
  template_code text not null,
  template_name text,
  template_content text not null check (length(btrim(template_content)) > 0),
  template_buttons jsonb not null check (jsonb_typeof(template_buttons) = 'array'),
  variable_bindings jsonb not null default '{}' check (jsonb_typeof(variable_bindings) = 'object'),
  version bigint not null default 1 check (version > 0),
  selected_by_user_id uuid not null,
  updated_at timestamptz not null default clock_timestamp(),
  primary key (shop_id, template_alias)
);
alter table public.shop_alimtalk_template_selections enable row level security;
revoke all on public.shop_alimtalk_template_selections from public,anon,authenticated;
grant select,insert,update on public.shop_alimtalk_template_selections to service_role;

create function public.set_shop_alimtalk_template_selection(
  p_shop text, p_alias text, p_template jsonb, p_bindings jsonb,
  p_expected_version bigint, p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  prior public.shop_alimtalk_template_selections%rowtype;
  saved public.shop_alimtalk_template_selections%rowtype;
  code text := nullif(btrim(p_template->>'templateCode'),'');
begin
  if p_actor is null or nullif(btrim(p_alias),'') is null or code is null
    or upper(coalesce(p_template->>'inspectionStatus','')) <> 'APR'
    or upper(coalesce(p_template->>'serviceStatus','')) not in ('A','R','ACT','RDY','ACTIVE','READY')
    or nullif(btrim(p_template->>'templateContent'),'') is null
    or jsonb_typeof(p_template->'buttons') is distinct from 'array'
    or jsonb_typeof(p_bindings) is distinct from 'object' then
    raise exception 'PM_TEMPLATE_NOT_APPROVED_OR_INVALID';
  end if;
  if exists(select 1 from public.shop_alimtalk_template_requests where template_code=code and shop_id<>p_shop) then
    raise exception 'PM_TEMPLATE_PRIVATE_TO_ANOTHER_SHOP';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('shop-alimtalk-selection:'||p_shop||':'||p_alias,0));
  select * into prior from public.shop_alimtalk_template_selections where shop_id=p_shop and template_alias=p_alias for update;
  if coalesce(prior.version,0) is distinct from p_expected_version then
    raise exception 'PM_TEMPLATE_MAPPING_CHANGED' using errcode='40001';
  end if;
  insert into public.shop_alimtalk_template_selections(
    shop_id,template_alias,template_code,template_name,template_content,template_buttons,variable_bindings,version,selected_by_user_id
  ) values(p_shop,p_alias,code,p_template->>'templateName',p_template->>'templateContent',p_template->'buttons',p_bindings,coalesce(prior.version,0)+1,p_actor)
  on conflict(shop_id,template_alias) do update set
    template_code=excluded.template_code,template_name=excluded.template_name,template_content=excluded.template_content,
    template_buttons=excluded.template_buttons,variable_bindings=excluded.variable_bindings,version=excluded.version,
    selected_by_user_id=excluded.selected_by_user_id,updated_at=clock_timestamp()
  returning * into saved;
  insert into public.platform_alimtalk_template_events(template_alias,provider_template_code,event_type,next_status,message,provider_payload)
  values(p_alias,code,'mapped','active','매장 오너가 승인 템플릿 선택',jsonb_build_object('shop_id',p_shop,'previous_code',prior.template_code,'version',saved.version,'actor_id',p_actor));
  return to_jsonb(saved);
end $$;
revoke all on function public.set_shop_alimtalk_template_selection(text,text,jsonb,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.set_shop_alimtalk_template_selection(text,text,jsonb,jsonb,bigint,uuid) to service_role;
notify pgrst,'reload schema';
commit;
