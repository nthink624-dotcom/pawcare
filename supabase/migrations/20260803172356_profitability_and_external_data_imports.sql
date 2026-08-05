-- Add durable profitability snapshots and privacy-minimal external import audit rows.

create table if not exists public.shop_data_import_batches (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  source text not null check (source in ('teepee', 'generic')),
  file_name text not null default '',
  file_sha256 text not null,
  status text not null default 'processing' check (status in ('processing', 'completed', 'failed')),
  total_rows integer not null default 0 check (total_rows >= 0),
  imported_guardian_count integer not null default 0 check (imported_guardian_count >= 0),
  merged_guardian_count integer not null default 0 check (merged_guardian_count >= 0),
  imported_pet_count integer not null default 0 check (imported_pet_count >= 0),
  merged_pet_count integer not null default 0 check (merged_pet_count >= 0),
  imported_visit_count integer not null default 0 check (imported_visit_count >= 0),
  imported_price_guide_count integer not null default 0 check (imported_price_guide_count >= 0),
  skipped_row_count integer not null default 0 check (skipped_row_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  error_message text,
  created_by_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (shop_id, source, file_sha256)
);

create table if not exists public.shop_data_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.shop_data_import_batches(id) on delete cascade,
  shop_id text not null references public.shops(id) on delete cascade,
  row_number integer not null check (row_number >= 1),
  entity_type text not null check (entity_type in ('customer', 'visit', 'price_guide')),
  row_fingerprint text not null,
  status text not null check (status in ('imported', 'merged', 'skipped', 'failed')),
  guardian_id uuid references public.guardians(id) on delete set null,
  pet_id uuid references public.pets(id) on delete set null,
  grooming_record_id uuid references public.grooming_records(id) on delete set null,
  service_id text references public.services(id) on delete set null,
  error_code text,
  created_at timestamptz not null default now(),
  unique (batch_id, entity_type, row_fingerprint)
);

alter table public.shop_data_import_batches enable row level security;
alter table public.shop_data_import_rows enable row level security;

revoke all on table public.shop_data_import_batches from anon, authenticated;
revoke all on table public.shop_data_import_rows from anon, authenticated;
grant all on table public.shop_data_import_batches to service_role;
grant all on table public.shop_data_import_rows to service_role;

create index if not exists shop_data_import_batches_shop_created_idx
  on public.shop_data_import_batches (shop_id, created_at desc);

create index if not exists shop_data_import_rows_batch_status_idx
  on public.shop_data_import_rows (batch_id, status, row_number);

alter table public.grooming_records
  add column if not exists expected_duration_minutes integer
    check (expected_duration_minutes is null or expected_duration_minutes between 1 and 1440),
  add column if not exists original_price integer
    check (original_price is null or original_price >= 0),
  add column if not exists discount_amount integer not null default 0
    check (discount_amount >= 0),
  add column if not exists pet_breed_snapshot text,
  add column if not exists pet_weight_snapshot numeric(6, 2)
    check (pet_weight_snapshot is null or pet_weight_snapshot > 0),
  add column if not exists pricing_group_snapshot text,
  add column if not exists service_name_snapshot text,
  add column if not exists record_source text not null default 'owner'
    check (record_source in ('owner', 'external_import')),
  add column if not exists external_source text,
  add column if not exists external_record_key text,
  add column if not exists import_batch_id uuid references public.shop_data_import_batches(id) on delete set null;

create unique index if not exists grooming_records_external_source_key_unique
  on public.grooming_records (shop_id, external_source, external_record_key)
  where external_source is not null and external_record_key is not null;

create index if not exists grooming_records_shop_profitability_idx
  on public.grooming_records (shop_id, groomed_at desc)
  include (service_id, staff_id, actual_duration_minutes, expected_duration_minutes, price_paid, discount_amount);

update public.grooming_records records
   set expected_duration_minutes = coalesce(
         records.expected_duration_minutes,
         greatest(1, round(extract(epoch from (appointments.end_at - appointments.start_at)) / 60)::integer)
       ),
       original_price = coalesce(
         records.original_price,
         nullif(appointments.original_service_price, 0),
         records.price_paid + coalesce(appointments.discount_amount, 0)
       ),
       discount_amount = greatest(records.discount_amount, coalesce(appointments.discount_amount, 0))
  from public.appointments appointments
 where appointments.id = records.appointment_id;

update public.grooming_records records
   set expected_duration_minutes = coalesce(records.expected_duration_minutes, services.duration_minutes),
       original_price = coalesce(records.original_price, records.price_paid + records.discount_amount),
       service_name_snapshot = coalesce(nullif(records.service_name_snapshot, ''), services.name)
  from public.services services
 where services.id = records.service_id;

update public.grooming_records records
   set pet_breed_snapshot = coalesce(nullif(records.pet_breed_snapshot, ''), pets.breed),
       pet_weight_snapshot = coalesce(records.pet_weight_snapshot, pets.weight),
       pricing_group_snapshot = coalesce(nullif(records.pricing_group_snapshot, ''), pets.pricing_group)
  from public.pets pets
 where pets.id = records.pet_id;

create or replace function public.sync_grooming_record_revenue_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_title text;
  resolved_gross_amount integer;
  resolved_discount_amount integer;
begin
  select coalesce(nullif(new.service_name_snapshot, ''), nullif(services.name, ''), 'Grooming service')
    into service_title
    from public.services
   where services.id = new.service_id;

  service_title := coalesce(service_title, nullif(new.service_name_snapshot, ''), 'Grooming service');
  resolved_gross_amount := greatest(coalesce(new.original_price, new.price_paid + new.discount_amount), 0);
  resolved_discount_amount := least(greatest(new.discount_amount, 0), resolved_gross_amount);

  insert into public.shop_revenue_entries (
    shop_id,
    appointment_id,
    grooming_record_id,
    guardian_id,
    pet_id,
    service_id,
    entry_date,
    occurred_at,
    revenue_type,
    status,
    payment_method,
    gross_amount,
    discount_amount,
    refund_amount,
    title,
    memo,
    source,
    metadata,
    created_at,
    updated_at
  ) values (
    new.shop_id,
    new.appointment_id,
    new.id,
    new.guardian_id,
    new.pet_id,
    new.service_id,
    (new.groomed_at at time zone 'Asia/Seoul')::date,
    new.groomed_at,
    'service',
    'paid',
    'unknown',
    resolved_gross_amount,
    resolved_discount_amount,
    0,
    service_title,
    coalesce(nullif(new.memo, ''), nullif(new.style_notes, ''), ''),
    'grooming_record',
    jsonb_strip_nulls(jsonb_build_object(
      'actualDurationMinutes', new.actual_duration_minutes,
      'expectedDurationMinutes', new.expected_duration_minutes,
      'nextRecommendedVisitDate', new.next_recommended_visit_date,
      'recordSource', new.record_source,
      'syncedFrom', 'grooming_records'
    )),
    coalesce(new.created_at, now()),
    now()
  )
  on conflict (grooming_record_id) where grooming_record_id is not null
  do update set
    appointment_id = excluded.appointment_id,
    guardian_id = excluded.guardian_id,
    pet_id = excluded.pet_id,
    service_id = excluded.service_id,
    entry_date = excluded.entry_date,
    occurred_at = excluded.occurred_at,
    gross_amount = excluded.gross_amount,
    discount_amount = excluded.discount_amount,
    title = excluded.title,
    memo = excluded.memo,
    metadata = coalesce(public.shop_revenue_entries.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists grooming_records_sync_revenue on public.grooming_records;
create trigger grooming_records_sync_revenue
after insert or update of appointment_id, guardian_id, pet_id, service_id, groomed_at, price_paid, original_price, discount_amount, style_notes, memo, actual_duration_minutes, expected_duration_minutes, next_recommended_visit_date, service_name_snapshot, record_source
on public.grooming_records
for each row
execute function public.sync_grooming_record_revenue_entry();

-- Re-sync existing rows with discount and timing snapshots.
update public.grooming_records
   set price_paid = price_paid;

notify pgrst, 'reload schema';
