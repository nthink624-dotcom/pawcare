alter table public.staff_members
  add column if not exists profile_image_fallback_key text;

alter table public.staff_members
  drop constraint if exists staff_members_profile_image_fallback_key_check;

alter table public.staff_members
  add constraint staff_members_profile_image_fallback_key_check
  check (profile_image_fallback_key is null or profile_image_fallback_key in (
    'korean-groomer-profile-01',
    'korean-groomer-profile-02'
  ));

comment on column public.staff_members.profile_image_fallback_key is
  'Explicit locally bundled staff avatar choice; not a gender attribute and never inferred.';
