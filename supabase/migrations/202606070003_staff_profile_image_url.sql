alter table if exists public.staff_members
  add column if not exists profile_image_url text not null default '';
