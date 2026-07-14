-- Owner-confirmed pricing group is separate from customer-entered breed.
alter table if exists public.pets
  add column if not exists pricing_group text;

comment on column public.pets.pricing_group is
  'Owner-confirmed detailed price guide group used for price calculation; never overwrite customer-entered breed.';
