-- No existing mappings or messages are rewritten. Apply separately from code deployment.
begin;
alter table public.platform_alimtalk_templates
  add column if not exists variable_bindings jsonb not null default '{}'::jsonb;
alter table public.platform_alimtalk_templates
  add constraint platform_alimtalk_template_bindings_object check (jsonb_typeof(variable_bindings) = 'object');

alter table public.shop_alimtalk_template_requests
  add column if not exists is_current boolean not null default false;
create unique index shop_alimtalk_template_requests_one_current_idx
  on public.shop_alimtalk_template_requests(shop_id, template_alias) where is_current;

create or replace function public.replace_platform_alimtalk_template(
  p_alias text, p_type text, p_config_key text, p_template jsonb,
  p_bindings jsonb, p_expected_current uuid default null,
  p_expected_updated_at timestamptz default null
) returns jsonb language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  prior public.platform_alimtalk_templates%rowtype;
  target public.platform_alimtalk_templates%rowtype;
  code text := nullif(btrim(p_template->>'templateCode'), '');
begin
  if p_template->>'inspectionStatus' is distinct from 'APR'
    or upper(coalesce(p_template->>'serviceStatus', '')) not in ('A','R','ACT','RDY','ACTIVE','READY')
    or code is null or nullif(btrim(p_template->>'templateContent'), '') is null
    or jsonb_typeof(p_template->'buttons') is distinct from 'array'
    or jsonb_typeof(p_bindings) is distinct from 'object' then
    raise exception 'PM_TEMPLATE_NOT_APPROVED_OR_INVALID';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('platform-alimtalk:' || p_alias, 0));
  select * into prior from public.platform_alimtalk_templates
    where provider='ssodaa' and template_alias=p_alias and service_status='active' for update;
  if prior.id is distinct from p_expected_current
    or (prior.id is not null and prior.updated_at is distinct from p_expected_updated_at) then
    raise exception 'PM_TEMPLATE_MAPPING_CHANGED' using errcode='40001';
  end if;
  select * into target from public.platform_alimtalk_templates
    where provider='ssodaa' and provider_template_code=code for update;
  if target.id is not null and target.template_alias is not null and target.template_alias <> p_alias then
    raise exception 'PM_TEMPLATE_ALREADY_ASSIGNED';
  end if;
  update public.platform_alimtalk_templates set service_status='inactive',updated_at=clock_timestamp()
    where id=prior.id and provider_template_code<>code;
  insert into public.platform_alimtalk_templates(
    provider,template_alias,notification_type,template_config_key,provider_template_code,
    template_name,template_content,buttons,variable_bindings,inspection_status,service_status,last_synced_at,updated_at
  ) values (
    'ssodaa',p_alias,p_type,p_config_key,code,coalesce(p_template->>'templateName',''),
    p_template->>'templateContent',p_template->'buttons',p_bindings,'approved','active',clock_timestamp(),clock_timestamp()
  ) on conflict (provider,provider_template_code) do update set
    template_alias=excluded.template_alias,notification_type=excluded.notification_type,
    template_config_key=excluded.template_config_key,template_name=excluded.template_name,
    template_content=excluded.template_content,buttons=excluded.buttons,variable_bindings=excluded.variable_bindings,
    inspection_status=excluded.inspection_status,service_status=excluded.service_status,
    last_synced_at=excluded.last_synced_at,updated_at=excluded.updated_at
  returning * into target;
  insert into public.platform_alimtalk_template_events(
    template_id,template_alias,provider_template_code,event_type,previous_status,next_status,message
  ) values (target.id,p_alias,code,'mapped',case when prior.id is null then null else 'active' end,'active','승인 템플릿 연결 교체');
  return to_jsonb(target);
end $$;

create or replace function public.activate_shop_alimtalk_template(
  p_shop text,p_request uuid,p_expected_current uuid,p_expected_content text,p_expected_buttons jsonb
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
declare
  candidate public.shop_alimtalk_template_requests%rowtype;
  prior uuid;
begin
  select * into candidate from public.shop_alimtalk_template_requests where id=p_request and shop_id=p_shop;
  if candidate.id is null then raise exception 'PM_SHOP_TEMPLATE_NOT_FOUND'; end if;
  perform pg_advisory_xact_lock(hashtextextended('shop-alimtalk:' || p_shop || ':' || candidate.template_alias, 0));
  select * into candidate from public.shop_alimtalk_template_requests where id=p_request and shop_id=p_shop for update;
  select id into prior from public.shop_alimtalk_template_requests
    where shop_id=p_shop and template_alias=candidate.template_alias and is_current for update;
  if prior is distinct from p_expected_current then
    raise exception 'PM_TEMPLATE_MAPPING_CHANGED' using errcode='40001';
  end if;
  if candidate.inspection_status <> 'approved'
    or upper(candidate.service_status) not in ('A','R','ACT','RDY','ACTIVE','READY')
    or candidate.template_content is distinct from p_expected_content
    or candidate.template_buttons is distinct from p_expected_buttons then
    raise exception 'PM_SHOP_TEMPLATE_NOT_APPROVED_OR_CHANGED';
  end if;
  update public.shop_alimtalk_template_requests set is_current=false where id=prior and id<>candidate.id;
  update public.shop_alimtalk_template_requests set is_current=true,updated_at=clock_timestamp() where id=candidate.id;
  if prior is distinct from candidate.id then
    insert into public.platform_alimtalk_template_events(
      template_alias,provider_template_code,event_type,previous_status,next_status,message,provider_payload
    ) values (candidate.template_alias,candidate.template_code,'mapped',case when prior is null then null else 'active' end,
      'active','매장 승인 문구 적용',jsonb_build_object('shop_id',p_shop,'request_id',candidate.id,'previous_request_id',prior));
  end if;
  return candidate.id;
end $$;

revoke all on function public.replace_platform_alimtalk_template(text,text,text,jsonb,jsonb,uuid,timestamptz) from public,anon,authenticated;
grant execute on function public.replace_platform_alimtalk_template(text,text,text,jsonb,jsonb,uuid,timestamptz) to service_role;
revoke all on function public.activate_shop_alimtalk_template(text,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.activate_shop_alimtalk_template(text,uuid,uuid,text,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
