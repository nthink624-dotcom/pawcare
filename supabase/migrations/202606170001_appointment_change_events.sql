create table if not exists public.appointment_change_events (
  id uuid primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  event_type text not null check (event_type in ('status', 'details')),
  previous_values jsonb not null default '{}'::jsonb,
  next_values jsonb not null default '{}'::jsonb,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists appointment_change_events_shop_created_idx
  on public.appointment_change_events (shop_id, created_at desc);

create index if not exists appointment_change_events_appointment_created_idx
  on public.appointment_change_events (appointment_id, created_at desc);

notify pgrst, 'reload schema';
