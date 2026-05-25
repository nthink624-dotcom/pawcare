alter table if exists public.shops
  add column if not exists regular_closed_cycle text not null default 'weekly',
  add column if not exists regular_closed_anchor_date date;

alter table if exists public.shops
  drop constraint if exists shops_regular_closed_cycle_check;

alter table if exists public.shops
  add constraint shops_regular_closed_cycle_check
    check (regular_closed_cycle in ('weekly', 'biweekly'));

update public.shops
set regular_closed_cycle = coalesce(nullif(regular_closed_cycle, ''), 'weekly')
where regular_closed_cycle is null
   or regular_closed_cycle = '';

notify pgrst, 'reload schema';
