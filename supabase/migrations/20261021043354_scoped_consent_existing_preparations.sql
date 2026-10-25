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
