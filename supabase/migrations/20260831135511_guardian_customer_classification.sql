-- Customer classification is shop-scoped guardian metadata, never an Auth role.
alter table if exists public.guardians
  add column if not exists customer_grade_override text,
  add column if not exists customer_member_type text not null default 'guardian';

alter table if exists public.guardians
  drop constraint if exists guardians_customer_grade_override_check,
  add constraint guardians_customer_grade_override_check
    check (customer_grade_override is null or customer_grade_override in ('normal', 'loyal', 'attention')),
  drop constraint if exists guardians_customer_member_type_check,
  add constraint guardians_customer_member_type_check
    check (customer_member_type in ('guardian', 'proxy', 'guest'));
