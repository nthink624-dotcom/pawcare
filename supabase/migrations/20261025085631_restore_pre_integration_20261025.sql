begin;
lock table public.shop_alimtalk_template_selections,public.shop_alimtalk_approval_notices,public.shop_alimtalk_approval_sync,public.pet_consent_recognitions in access exclusive mode;
do $$ begin
 if exists(select 1 from public.shop_alimtalk_template_selections)
 or exists(select 1 from public.shop_alimtalk_approval_notices)
 or exists(select 1 from public.shop_alimtalk_approval_sync)
 or exists(select 1 from public.pet_consent_recognitions)
 or exists(select 1 from public.platform_alimtalk_templates where variable_bindings <> '{}'::jsonb)
 or exists(select 1 from public.shop_alimtalk_template_requests where is_current)
 or exists(select 1 from public.pets where birthday_precision <> 'day')
 then raise exception 'UNDO_BLOCKED_NEW_OPERATIONAL_DATA'; end if;
end $$;
drop trigger scoped_booking_consent_snapshot on public.booking_preparations;
drop trigger validate_consent_recognition on public.pet_consent_recognitions;
drop function public.pm_recognize_import_consents(text,uuid,integer,uuid[],uuid);
drop function public.pm_record_consent_recognitions(text,uuid,uuid,uuid,integer,jsonb,uuid);
drop function public.pm_customer_consent_state(text,uuid,uuid,uuid);
drop function public.pm_scoped_booking_consent_snapshot();
drop function public.pm_validate_consent_recognition();
drop function public.pm_resolve_pet_consent(text,uuid,uuid,jsonb,jsonb);
drop function public.replace_platform_alimtalk_template(text,text,text,jsonb,jsonb,uuid,timestamptz);
drop function public.activate_shop_alimtalk_template(text,uuid,uuid,text,jsonb);
drop function public.set_shop_alimtalk_template_selection(text,text,jsonb,jsonb,bigint,uuid);
drop function public.observe_shop_alimtalk_approvals(text,bigint,jsonb);
drop function public.read_shop_alimtalk_approval(text,uuid,uuid);
drop table public.shop_alimtalk_template_selections;
drop table public.shop_alimtalk_approval_notices;
drop table public.shop_alimtalk_approval_sync;
drop table public.pet_consent_recognitions;
alter table public.platform_alimtalk_templates drop column variable_bindings;
drop index public.shop_alimtalk_template_requests_one_current_idx;
alter table public.shop_alimtalk_template_requests drop column is_current;
alter table public.pets drop constraint pets_birthday_precision_check;
alter table public.pets drop column birthday_precision,drop column age_reference_year;
notify pgrst,'reload schema';
commit;
