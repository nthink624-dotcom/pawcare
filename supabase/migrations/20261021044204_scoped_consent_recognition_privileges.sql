-- Supabase default privileges may grant all rights to service_role on new tables.
-- Recognition evidence is append-only; repeated assertions keep the original audit.
revoke all on public.pet_consent_recognitions from service_role;
grant select,insert on public.pet_consent_recognitions to service_role;
