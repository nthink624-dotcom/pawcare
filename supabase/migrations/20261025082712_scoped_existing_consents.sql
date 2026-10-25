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
