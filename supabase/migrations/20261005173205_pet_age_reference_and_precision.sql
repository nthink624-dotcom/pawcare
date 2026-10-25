alter table public.pets
  add column if not exists birthday_precision text not null default 'day',
  add column if not exists age_reference_year integer;

alter table public.pets
  add constraint pets_birthday_precision_check
  check (birthday_precision in ('day', 'month'));

update public.pets
set age_reference_year = extract(year from created_at)::integer
where age is not null
  and age_reference_year is null;

comment on column public.pets.birthday_precision is
  'Whether birthday contains an exact day or only a known year and month.';
comment on column public.pets.age_reference_year is
  'Korean calendar year when the stored age was reported; display adds elapsed calendar years.';
