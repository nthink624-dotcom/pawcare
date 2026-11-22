-- Owners may choose any compatible, approved shared SSODAA template per shop.
-- An unknown provider code becomes shared only at the explicit selection transaction;
-- reserved owner codes and codes already claimed by any shop remain private.
create or replace function public.guard_alimtalk_selection_scope() returns trigger
language plpgsql security invoker set search_path=pg_catalog,public as $$
declare r public.alimtalk_template_registry%rowtype;
begin
  perform pg_advisory_xact_lock(hashtextextended('alimtalk-code:'||new.template_code,0));
  select * into r from public.alimtalk_template_registry where template_code=new.template_code for share;
  if r.template_code is null or r.retired_at is not null then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
  if r.scope='shop' then
    if r.owner_shop_id is distinct from new.shop_id or not exists(
      select 1 from public.shop_alimtalk_template_requests q
      where q.shop_id=new.shop_id and q.template_alias=new.template_alias and q.template_code=new.template_code
    ) then raise exception 'PM_TEMPLATE_PRIVATE_TO_ANOTHER_SHOP'; end if;
  elsif r.scope<>'platform' then
    raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED';
  end if;
  return new;
end $$;

create or replace function public.set_shop_alimtalk_template_selection(
  p_shop text, p_alias text, p_template jsonb, p_bindings jsonb,
  p_expected_version bigint, p_actor uuid
) returns jsonb language plpgsql security invoker set search_path=pg_catalog,public as $$
declare
  prior public.shop_alimtalk_template_selections%rowtype;
  saved public.shop_alimtalk_template_selections%rowtype;
  ownership public.alimtalk_template_registry%rowtype;
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

  perform pg_advisory_xact_lock(hashtextextended('alimtalk-code:'||code,0));
  select * into ownership from public.alimtalk_template_registry where template_code=code for update;
  if ownership.template_code is null then
    if code ~ '^PM[0-9A-F]{26}$' or exists(
      select 1 from public.shop_alimtalk_template_requests where template_code=code
    ) then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
    insert into public.alimtalk_template_registry(template_code,scope)
      values(code,'platform') on conflict(template_code) do nothing;
    select * into ownership from public.alimtalk_template_registry where template_code=code for update;
  end if;
  if ownership.retired_at is not null then raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED'; end if;
  if ownership.scope='shop' then
    if ownership.owner_shop_id is distinct from p_shop or not exists(
      select 1 from public.shop_alimtalk_template_requests
      where shop_id=p_shop and template_alias=p_alias and template_code=code
    ) then raise exception 'PM_TEMPLATE_PRIVATE_TO_ANOTHER_SHOP'; end if;
  elsif ownership.scope<>'platform' then
    raise exception 'PM_TEMPLATE_PRIVATE_OR_RETIRED';
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
revoke all on function public.guard_alimtalk_selection_scope(),public.set_shop_alimtalk_template_selection(text,text,jsonb,jsonb,bigint,uuid) from public,anon,authenticated;
grant execute on function public.guard_alimtalk_selection_scope(),public.set_shop_alimtalk_template_selection(text,text,jsonb,jsonb,bigint,uuid) to service_role;
notify pgrst,'reload schema';
