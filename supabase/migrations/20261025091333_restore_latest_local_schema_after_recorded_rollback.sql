begin;
-- Reapply 20261025082656_pet_age_reference_and_precision.sql after the recorded rollback
alter table public.pets
  add column if not exists birthday_precision text not null default 'day',
  add column if not exists age_reference_year integer;

alter table public.pets
  add constraint pets_birthday_precision_check
  check (birthday_precision in ('day', 'month'));

update public.pets
set age_reference_year = extract(year from created_at)::integer
where age is not null
  and age_reference_year is null;

comment on column public.pets.birthday_precision is
  'Whether birthday contains an exact day or only a known year and month.';
comment on column public.pets.age_reference_year is
  'Korean calendar year when the stored age was reported; display adds elapsed calendar years.';

-- Reapply 20261025082702_atomic_alimtalk_template_mapping.sql after the recorded rollback
-- No existing mappings or messages are rewritten. Apply separately from code deployment.
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

-- Reapply 20261025082704_shop_alimtalk_template_selections.sql after the recorded rollback
-- Owner selections are independent of platform defaults and review drafts.
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

-- Reapply 20261025082707_shop_alimtalk_approval_notices.sql after the recorded rollback
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

-- Reapply 20261025082712_scoped_existing_consents.sql after the recorded rollback
-- Recognition is an owner assertion about one existing document, never a signature.
create table if not exists public.pet_consent_import_status (
  shop_id text not null references public.shops(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  status text not null check(status in ('needs_consent','recognized')),
  import_batch_id uuid references public.shop_data_import_batches(id) on delete set null,
  updated_at timestamptz not null default now(), primary key(shop_id,pet_id)
);
alter table public.pet_consent_import_status enable row level security;
revoke all on public.pet_consent_import_status from public,anon,authenticated;
grant select,insert,update,delete on public.pet_consent_import_status to service_role;

create table public.pet_consent_recognitions (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  template_id text not null, template_version integer not null check(template_version>0),
  document jsonb not null,
  recognized_by uuid not null references auth.users(id),
  recognized_at timestamptz not null default now(),
  import_batch_id uuid references public.shop_data_import_batches(id) on delete set null,
  unique(shop_id,pet_id,template_id,template_version)
);
alter table public.pet_consent_recognitions enable row level security;
revoke all on public.pet_consent_recognitions from public,anon,authenticated;
grant select,insert on public.pet_consent_recognitions to service_role;

create function public.pm_resolve_pet_consent(p_shop text,p_guardian uuid,p_pet uuid,p_template jsonb,p_templates jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare accepted jsonb; recognition public.pet_consent_recognitions%rowtype;
  ids text[]:=array[p_template->>'id']; predecessor text; next_template jsonb;
begin
  if p_template->>'scope'<>'pet' then return null; end if;
  select c into accepted from booking_preparations b,lateral jsonb_array_elements(b.data->'consents') c
    where b.shop_id=p_shop and b.guardian_id=p_guardian and b.pet_id=p_pet
      and c->>'id'=p_template->>'id' and c->>'version'=p_template->>'version'
      and c->>'body'=p_template->>'body' and c->>'status'='signed'
    order by b.updated_at desc limit 1;
  if accepted is not null then return accepted; end if;
  select * into recognition from pet_consent_recognitions r where r.shop_id=p_shop and r.guardian_id=p_guardian
    and r.pet_id=p_pet and r.template_id=p_template->>'id' and r.template_version=(p_template->>'version')::integer
    and r.document->>'body'=p_template->>'body';
  if recognition.id is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',recognition.recognized_at,
      'recognizedBy',recognition.recognized_by,'recognitionId',recognition.id,'recognitionSource','owner');
  end if;
  if coalesce((p_template->>'reconsentExisting')::boolean,true) then return null; end if;
  -- Reuse older versions only within this document's explicit replacement chain.
  next_template:=p_template;
  loop
    predecessor:=next_template->>'previousTemplateId';
    exit when predecessor is null or predecessor=any(ids) or cardinality(ids)>100;
    select t into next_template from jsonb_array_elements(p_templates) t where t->>'id'=predecessor and t->>'scope'='pet';
    exit when next_template is null;
    ids:=array_append(ids,predecessor);
  end loop;
  select c into accepted from booking_preparations b,lateral jsonb_array_elements(b.data->'consents') c
    where b.shop_id=p_shop and b.guardian_id=p_guardian and b.pet_id=p_pet
      and c->>'id'=any(ids) and c->>'scope'='pet' and c->>'status'='signed'
    order by b.updated_at desc limit 1;
  if accepted is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',accepted->>'signedAt',
      'recognitionSource','prior_signature','recognizedTemplateId',accepted->>'id','recognizedTemplateVersion',accepted->'version');
  end if;
  select * into recognition from pet_consent_recognitions r where r.shop_id=p_shop and r.guardian_id=p_guardian
    and r.pet_id=p_pet and r.template_id=any(ids) and r.document->>'scope'='pet'
    order by r.recognized_at desc limit 1;
  if recognition.id is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',recognition.recognized_at,
      'recognizedBy',recognition.recognized_by,'recognitionId',recognition.id,'recognitionSource','owner',
      'recognizedTemplateId',recognition.template_id,'recognizedTemplateVersion',recognition.template_version);
  end if;
  return null;
end $$;

create function public.pm_customer_consent_state(p_shop text,p_guardian uuid,p_pet uuid,p_appointment uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare p jsonb; pv integer; t jsonb; accepted jsonb; documents jsonb:='[]'; current_data jsonb;
begin
  if not exists(select 1 from pets where shop_id=p_shop and guardian_id=p_guardian and id=p_pet)
    or not exists(select 1 from guardians where shop_id=p_shop and id=p_guardian and deleted_at is null)
    then raise exception 'CONSENT_CUSTOMER_NOT_FOUND'; end if;
  select policy,version into p,pv from shop_booking_policies where shop_id=p_shop;
  if not coalesce((p->>'consentBeforeStart')::boolean,false) then
    return jsonb_build_object('enabled',false,'policyVersion',coalesce(pv,0),'documents','[]'::jsonb);
  end if;
  if p_appointment is not null then
    select b.data into current_data from booking_preparations b where b.shop_id=p_shop and b.guardian_id=p_guardian
      and b.pet_id=p_pet and b.appointment_id=p_appointment;
  end if;
  for t in select value from jsonb_array_elements(p->'templates') loop
    if not coalesce((t->>'enabled')::boolean,false) or t->>'archivedAt' is not null then continue; end if;
    accepted:=null;
    select c into accepted from jsonb_array_elements(coalesce(current_data->'consents','[]')) c
      where c->>'id'=t->>'id' and c->>'version'=t->>'version' and c->>'status'='signed' and c->>'body'=t->>'body' limit 1;
    if accepted is null then accepted:=pm_resolve_pet_consent(p_shop,p_guardian,p_pet,t,p->'templates'); end if;
    documents:=documents||jsonb_build_array(coalesce(accepted,t||'{"status":"pending"}'::jsonb));
  end loop;
  return jsonb_build_object('enabled',true,'policyVersion',pv,'documents',documents);
end $$;

create function public.pm_scoped_booking_consent_snapshot() returns trigger
language plpgsql security invoker set search_path=public as $$
declare t jsonb; accepted jsonb; documents jsonb:='[]';
begin
  if coalesce((new.data#>>'{policy,consentBeforeStart}')::boolean,false) then
    for t in select value from jsonb_array_elements(coalesce(new.data->'consents','[]')) loop
      if not coalesce((t->>'enabled')::boolean,false) or t->>'archivedAt' is not null then continue; end if;
      if t->>'status'='signed' then documents:=documents||jsonb_build_array(t); continue; end if;
      accepted:=pm_resolve_pet_consent(new.shop_id,new.guardian_id,new.pet_id,t,new.data#>'{policy,templates}');
      documents:=documents||jsonb_build_array(coalesce(accepted,(t-'recognizedAt'-'recognizedBy'-'signature'-'signedAt')||'{"status":"pending"}'::jsonb));
    end loop;
  end if;
  new.data:=jsonb_set(new.data,'{consents}',documents);
  return new;
end $$;
create trigger scoped_booking_consent_snapshot before insert on public.booking_preparations
  for each row execute function public.pm_scoped_booking_consent_snapshot();

create function public.pm_record_consent_recognitions(p_shop text,p_guardian uuid,p_pet uuid,p_actor uuid,
  p_policy_version integer,p_documents jsonb,p_batch uuid default null)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare p jsonb; pv integer; chosen jsonb; t jsonb; a record; next_consents jsonb;
begin
  select policy,version into p,pv from shop_booking_policies where shop_id=p_shop for share;
  if pv is distinct from p_policy_version then raise exception 'CONSENT_POLICY_CHANGED'; end if;
  if not coalesce((p->>'consentBeforeStart')::boolean,false) then raise exception 'CONSENT_DISABLED'; end if;
  if p_actor is null or not exists(select 1 from pets where id=p_pet and guardian_id=p_guardian and shop_id=p_shop)
    or not exists(select 1 from guardians where id=p_guardian and shop_id=p_shop and deleted_at is null)
    then raise exception 'CONSENT_CUSTOMER_NOT_FOUND'; end if;
  if p_batch is not null and not exists(select 1 from shop_data_import_batches where id=p_batch and shop_id=p_shop)
    then raise exception 'CONSENT_BATCH_NOT_FOUND'; end if;
  if jsonb_array_length(p_documents)=0 then raise exception 'CONSENT_DOCUMENT_REQUIRED'; end if;
  for chosen in select value from jsonb_array_elements(p_documents) loop
    select value into t from jsonb_array_elements(p->'templates') where value->>'id'=chosen->>'id'
      and value->>'version'=chosen->>'version' and value->>'scope'='pet' and (value->>'enabled')::boolean
      and value->>'archivedAt' is null;
    if t is null then raise exception 'CONSENT_DOCUMENT_CHANGED_OR_APPOINTMENT_SCOPE'; end if;
    insert into pet_consent_recognitions(shop_id,guardian_id,pet_id,template_id,template_version,document,recognized_by,import_batch_id)
      values(p_shop,p_guardian,p_pet,t->>'id',(t->>'version')::integer,t,p_actor,p_batch)
      on conflict(shop_id,pet_id,template_id,template_version) do nothing;
    if not exists(select 1 from pet_consent_recognitions r where r.shop_id=p_shop and r.pet_id=p_pet
      and r.template_id=t->>'id' and r.template_version=(t->>'version')::integer and r.document->>'body'=t->>'body')
      then raise exception 'CONSENT_DOCUMENT_CHANGED_OR_APPOINTMENT_SCOPE'; end if;
  end loop;
  for a in select b.* from booking_preparations b join appointments ap on ap.id=b.appointment_id
    where b.shop_id=p_shop and b.guardian_id=p_guardian and b.pet_id=p_pet and ap.status in ('pending','confirmed')
    order by b.appointment_id for update of b loop
    select coalesce(jsonb_agg(case when c->>'status'='pending' then
      coalesce(pm_resolve_pet_consent(p_shop,p_guardian,p_pet,c,p->'templates'),c) else c end order by ord),'[]')
      into next_consents from jsonb_array_elements(a.data->'consents') with ordinality as docs(c,ord);
    if next_consents is distinct from a.data->'consents' then
      update booking_preparations set data=jsonb_set(a.data,'{consents}',next_consents),version=version+1,updated_at=now()
        where appointment_id=a.appointment_id;
    end if;
  end loop;
  return pm_customer_consent_state(p_shop,p_guardian,p_pet);
end $$;

create function public.pm_recognize_import_consents(p_shop text,p_actor uuid,p_policy_version integer,p_pet_ids uuid[],p_batch uuid)
returns integer language plpgsql security invoker set search_path=public as $$
declare documents jsonb; p record; processed integer:=0;
begin
  select coalesce(jsonb_agg(jsonb_build_object('id',t->>'id','version',t->'version')),'[]') into documents
    from shop_booking_policies s,lateral jsonb_array_elements(s.policy->'templates') t
    where s.shop_id=p_shop and s.version=p_policy_version and (s.policy->>'consentBeforeStart')::boolean
      and t->>'scope'='pet' and (t->>'enabled')::boolean and t->>'archivedAt' is null;
  if jsonb_array_length(documents)=0 then raise exception 'CONSENT_POLICY_CHANGED'; end if;
  if exists(select 1 from unnest(p_pet_ids) as requested(pet_id) where not exists(select 1 from pets where pets.id=requested.pet_id and shop_id=p_shop))
    then raise exception 'CONSENT_CUSTOMER_NOT_FOUND'; end if;
  for p in select id,guardian_id from pets where shop_id=p_shop and id=any(p_pet_ids) order by id loop
    perform pm_record_consent_recognitions(p_shop,p.guardian_id,p.id,p_actor,p_policy_version,documents,p_batch);
    processed:=processed+1;
  end loop;
  return processed;
end $$;

revoke all on function public.pm_resolve_pet_consent(text,uuid,uuid,jsonb,jsonb),
 public.pm_customer_consent_state(text,uuid,uuid,uuid),public.pm_scoped_booking_consent_snapshot(),
 public.pm_record_consent_recognitions(text,uuid,uuid,uuid,integer,jsonb,uuid),
 public.pm_recognize_import_consents(text,uuid,integer,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.pm_resolve_pet_consent(text,uuid,uuid,jsonb,jsonb),
 public.pm_customer_consent_state(text,uuid,uuid,uuid),public.pm_scoped_booking_consent_snapshot(),
 public.pm_record_consent_recognitions(text,uuid,uuid,uuid,integer,jsonb,uuid),
 public.pm_recognize_import_consents(text,uuid,integer,uuid[],uuid) to service_role;
notify pgrst,'reload schema';

-- Reapply 20261025082715_scoped_consent_existing_preparations.sql after the recorded rollback
create or replace function public.pm_resolve_pet_consent(p_shop text,p_guardian uuid,p_pet uuid,p_template jsonb,p_templates jsonb)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare accepted jsonb; recognition public.pet_consent_recognitions%rowtype;
  ids text[]:=array[p_template->>'id']; predecessor text; next_template jsonb;
begin
  p_template := p_template - 'signature' - 'signerName' - 'signedAt' - 'acceptanceMethod' - 'recognizedAt' - 'recognizedBy' - 'recognitionId';
  if p_template->>'scope'<>'pet' then return null; end if;
  select c into accepted from booking_preparations b,lateral jsonb_array_elements(b.data->'consents') c
    where b.shop_id=p_shop and b.guardian_id=p_guardian and b.pet_id=p_pet
      and c->>'id'=p_template->>'id' and c->>'version'=p_template->>'version'
      and c->>'body'=p_template->>'body' and c->>'status'='signed'
    order by b.updated_at desc limit 1;
  if accepted is not null then return accepted; end if;
  select * into recognition from pet_consent_recognitions r where r.shop_id=p_shop and r.guardian_id=p_guardian
    and r.pet_id=p_pet and r.template_id=p_template->>'id' and r.template_version=(p_template->>'version')::integer
    and r.document->>'body'=p_template->>'body';
  if recognition.id is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',recognition.recognized_at,
      'recognizedBy',recognition.recognized_by,'recognitionId',recognition.id,'recognitionSource','owner');
  end if;
  if coalesce((p_template->>'reconsentExisting')::boolean,true) then return null; end if;
  -- Reuse older versions only within this document's explicit replacement chain.
  next_template:=p_template;
  loop
    predecessor:=next_template->>'previousTemplateId';
    exit when predecessor is null or predecessor=any(ids) or cardinality(ids)>100;
    select t into next_template from jsonb_array_elements(p_templates) t where t->>'id'=predecessor and t->>'scope'='pet';
    exit when next_template is null;
    ids:=array_append(ids,predecessor);
  end loop;
  select c into accepted from booking_preparations b,lateral jsonb_array_elements(b.data->'consents') c
    where b.shop_id=p_shop and b.guardian_id=p_guardian and b.pet_id=p_pet
      and c->>'id'=any(ids) and c->>'scope'='pet' and c->>'status'='signed'
    order by b.updated_at desc limit 1;
  if accepted is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',accepted->>'signedAt',
      'recognitionSource','prior_signature','recognizedTemplateId',accepted->>'id','recognizedTemplateVersion',accepted->'version');
  end if;
  select * into recognition from pet_consent_recognitions r where r.shop_id=p_shop and r.guardian_id=p_guardian
    and r.pet_id=p_pet and r.template_id=any(ids) and r.document->>'scope'='pet'
    order by r.recognized_at desc limit 1;
  if recognition.id is not null then
    return p_template||jsonb_build_object('status','recognized','recognizedAt',recognition.recognized_at,
      'recognizedBy',recognition.recognized_by,'recognitionId',recognition.id,'recognitionSource','owner',
      'recognizedTemplateId',recognition.template_id,'recognizedTemplateVersion',recognition.template_version);
  end if;
  return null;
end $$;

-- Enforce the same customer/document/actor boundary even for trusted bulk writers.
create function public.pm_validate_consent_recognition() returns trigger
language plpgsql security invoker set search_path=public as $$
begin
  if not exists(select 1 from pets where id=new.pet_id and guardian_id=new.guardian_id and shop_id=new.shop_id)
    or new.document->>'id' is distinct from new.template_id
    or new.document->>'version' is distinct from new.template_version::text
    or new.document->>'scope' is distinct from 'pet'
    or new.document ? 'signature' or new.document ? 'signedAt'
    then raise exception 'CONSENT_RECOGNITION_SCOPE_INVALID'; end if;
  if not exists(select 1 from shops where id=new.shop_id and owner_user_id=new.recognized_by)
    and not exists(select 1 from owner_shop_memberships where shop_id=new.shop_id and owner_user_id=new.recognized_by and role='owner')
    then raise exception 'CONSENT_RECOGNITION_OWNER_REQUIRED'; end if;
  return new;
end $$;
create trigger validate_consent_recognition before insert on public.pet_consent_recognitions
  for each row execute function public.pm_validate_consent_recognition();
revoke all on function public.pm_validate_consent_recognition() from public,anon,authenticated;
grant execute on function public.pm_validate_consent_recognition() to service_role;

-- Keep the original unscoped assertion as evidence; never manufacture its actor or signature.
do $$
declare b record; c jsonb; resolved jsonb; documents jsonb;
begin
  for b in select prep.* from booking_preparations prep join appointments a on a.id=prep.appointment_id
    where a.status in ('pending','confirmed') and exists (
      select 1 from jsonb_array_elements(prep.data->'consents') item where item->>'status'='recognized'
    ) order by prep.appointment_id for update of prep loop
    documents:='[]';
    for c in select value from jsonb_array_elements(b.data->'consents') loop
      if c->>'status'='recognized' then
        resolved:=pm_resolve_pet_consent(b.shop_id,b.guardian_id,b.pet_id,c,b.data#>'{policy,templates}');
        if resolved is null then
          resolved:=(c-'signature'-'signerName'-'signedAt'-'recognizedAt'-'recognizedBy')
            ||jsonb_build_object('status','pending','legacyRecognition',c);
        end if;
        documents:=documents||jsonb_build_array(resolved);
      else documents:=documents||jsonb_build_array(c); end if;
    end loop;
    if documents is distinct from b.data->'consents' then
      update booking_preparations set data=jsonb_set(b.data,'{consents}',documents),version=version+1,updated_at=now()
        where appointment_id=b.appointment_id;
    end if;
  end loop;
end $$;
notify pgrst,'reload schema';

-- Reapply 20261025082718_scoped_consent_recognition_privileges.sql after the recorded rollback
-- Supabase default privileges may grant all rights to service_role on new tables.
-- Recognition evidence is append-only; repeated assertions keep the original audit.
revoke all on public.pet_consent_recognitions from service_role;
grant select,insert on public.pet_consent_recognitions to service_role;
commit;
