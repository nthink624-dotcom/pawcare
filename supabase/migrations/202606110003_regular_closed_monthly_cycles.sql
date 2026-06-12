alter table if exists public.shops
  drop constraint if exists shops_regular_closed_cycle_check;

alter table if exists public.shops
  add constraint shops_regular_closed_cycle_check
    check (regular_closed_cycle in ('weekly', 'biweekly', 'monthly_1_3', 'monthly_2_4'));

notify pgrst, 'reload schema';
