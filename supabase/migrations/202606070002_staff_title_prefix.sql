alter table if exists public.staff_members
  add column if not exists title_prefix text not null default '';

notify pgrst, 'reload schema';
