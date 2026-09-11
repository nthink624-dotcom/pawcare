-- Preserve explicit per-appointment weight measurements without treating the
-- pet profile's older weight as a measurement made today.
create table if not exists public.appointment_visit_weight_measurements (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  weight_kg numeric(5, 2) not null check (weight_kg between 0.1 and 200),
  measured_at timestamptz not null default now(),
  measured_by_user_id uuid references auth.users(id) on delete set null,
  idempotency_key_hash text not null check (char_length(idempotency_key_hash) = 64),
  created_at timestamptz not null default now(),
  unique (shop_id, appointment_id, idempotency_key_hash)
);

create index if not exists appointment_visit_weight_current_idx
  on public.appointment_visit_weight_measurements (shop_id, appointment_id, measured_at desc, id desc);

create index if not exists appointment_visit_weight_pet_history_idx
  on public.appointment_visit_weight_measurements (shop_id, pet_id, measured_at desc, id desc);

alter table public.appointment_visit_weight_measurements enable row level security;
revoke all on table public.appointment_visit_weight_measurements from public, anon, authenticated;
grant all on table public.appointment_visit_weight_measurements to service_role;

notify pgrst, 'reload schema';
