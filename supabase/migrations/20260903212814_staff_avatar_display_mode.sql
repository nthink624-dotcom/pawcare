alter table public.staff_members
  add column if not exists avatar_display_mode text not null default 'default';

alter table public.staff_members
  drop constraint if exists staff_members_avatar_display_mode_check;

alter table public.staff_members
  add constraint staff_members_avatar_display_mode_check
  check (avatar_display_mode in ('default', 'mock', 'photo'));

comment on column public.staff_members.avatar_display_mode is
  'Explicit staff avatar presentation preference. It never infers whether a photo asset exists.';
