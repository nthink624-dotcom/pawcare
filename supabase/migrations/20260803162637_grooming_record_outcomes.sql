-- Keep one completed grooming outcome connected to operational timing,
-- customer history, and revenue analytics.

alter table if exists public.grooming_records
  add column if not exists actual_duration_minutes integer
    check (actual_duration_minutes is null or actual_duration_minutes between 0 and 1440),
  add column if not exists next_recommended_visit_date date;

create index if not exists grooming_records_shop_next_visit_idx
  on public.grooming_records (shop_id, next_recommended_visit_date)
  where next_recommended_visit_date is not null;

create or replace function public.sync_grooming_record_revenue_entry()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  service_title text;
begin
  select coalesce(nullif(services.name, ''), 'Grooming service')
    into service_title
    from public.services
   where services.id = new.service_id;

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
    greatest(new.price_paid, 0),
    0,
    0,
    coalesce(service_title, 'Grooming service'),
    coalesce(nullif(new.memo, ''), nullif(new.style_notes, ''), ''),
    'grooming_record',
    jsonb_strip_nulls(jsonb_build_object(
      'actualDurationMinutes', new.actual_duration_minutes,
      'nextRecommendedVisitDate', new.next_recommended_visit_date,
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
    title = excluded.title,
    memo = excluded.memo,
    metadata = coalesce(public.shop_revenue_entries.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists grooming_records_sync_revenue on public.grooming_records;
create trigger grooming_records_sync_revenue
after insert or update of appointment_id, guardian_id, pet_id, service_id, groomed_at, price_paid, style_notes, memo, actual_duration_minutes, next_recommended_visit_date
on public.grooming_records
for each row
execute function public.sync_grooming_record_revenue_entry();

-- Repair records created after the original revenue-ledger backfill.
update public.grooming_records
   set price_paid = price_paid;

notify pgrst, 'reload schema';
