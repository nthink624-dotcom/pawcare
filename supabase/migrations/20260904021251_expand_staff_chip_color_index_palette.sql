alter table if exists public.staff_members
  drop constraint if exists staff_members_chip_color_index_check,
  add constraint staff_members_chip_color_index_check
    check (chip_color_index is null or chip_color_index between 0 and 9);

notify pgrst, 'reload schema';
