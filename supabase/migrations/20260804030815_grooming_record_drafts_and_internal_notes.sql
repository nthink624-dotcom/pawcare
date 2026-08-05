-- Keep in-progress grooming notes durable without turning an unfinished draft
-- into a completed customer history or revenue record.

alter table if exists public.grooming_records
  add column if not exists internal_memo text not null default '';

create table if not exists public.grooming_record_drafts (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  guardian_id uuid not null references public.guardians(id) on delete cascade,
  pet_id uuid not null references public.pets(id) on delete cascade,
  treatment_notes text not null default '' check (char_length(treatment_notes) <= 2000),
  special_notes text not null default '' check (char_length(special_notes) <= 2000),
  internal_notes text not null default '' check (char_length(internal_notes) <= 4000),
  next_recommended_visit_date date,
  after_media_asset_id uuid references public.media_assets(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (appointment_id)
);

create index if not exists grooming_record_drafts_shop_updated_idx
  on public.grooming_record_drafts (shop_id, updated_at desc);

alter table public.grooming_record_drafts enable row level security;

revoke all on table public.grooming_record_drafts from anon, authenticated;
grant all on table public.grooming_record_drafts to service_role;

notify pgrst, 'reload schema';
