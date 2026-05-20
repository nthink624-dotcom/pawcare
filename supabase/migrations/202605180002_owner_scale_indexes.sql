create index if not exists guardians_shop_id_created_at_idx
  on public.guardians(shop_id, created_at);

create index if not exists guardians_shop_id_deleted_at_idx
  on public.guardians(shop_id, deleted_at, deleted_restore_until);

create index if not exists pets_shop_id_guardian_id_created_at_idx
  on public.pets(shop_id, guardian_id, created_at);

create index if not exists appointments_shop_id_date_time_idx
  on public.appointments(shop_id, appointment_date, appointment_time);

create index if not exists appointments_shop_id_guardian_date_idx
  on public.appointments(shop_id, guardian_id, appointment_date);

create index if not exists appointments_shop_id_pet_date_idx
  on public.appointments(shop_id, pet_id, appointment_date);

create index if not exists appointments_shop_id_status_date_idx
  on public.appointments(shop_id, status, appointment_date);

create index if not exists grooming_records_shop_id_groomed_at_idx
  on public.grooming_records(shop_id, groomed_at desc);

create index if not exists grooming_records_shop_id_guardian_groomed_at_idx
  on public.grooming_records(shop_id, guardian_id, groomed_at desc);

create index if not exists grooming_records_shop_id_pet_groomed_at_idx
  on public.grooming_records(shop_id, pet_id, groomed_at desc);

create index if not exists notifications_shop_id_created_at_idx
  on public.notifications(shop_id, created_at desc);

create index if not exists notifications_shop_id_guardian_created_at_idx
  on public.notifications(shop_id, guardian_id, created_at desc);
