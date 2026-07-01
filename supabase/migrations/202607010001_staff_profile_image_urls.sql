alter table if exists public.staff_members
  add column if not exists profile_image_urls jsonb not null default '[]'::jsonb;

alter table if exists public.staff_members
  add column if not exists profile_image_asset_ids jsonb not null default '[]'::jsonb;

comment on column public.staff_members.profile_image_urls is
  'Customer-facing staff profile image URLs. Maximum 3 images are used by PetManager.';

comment on column public.staff_members.profile_image_asset_ids is
  'Media asset IDs for customer-facing staff profile images. Maximum 3 images are used by PetManager.';
