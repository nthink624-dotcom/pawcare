alter table if exists public.staff_members
  add column if not exists profile_message text not null default '';

comment on column public.staff_members.profile_message is
  'Customer-facing staff profile message shown on the booking entry page.';
