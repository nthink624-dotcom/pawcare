-- AI care reports extend the existing grooming draft/final record flow.
-- Drafts remain non-customer-visible. Only an owner-confirmed final record may
-- be projected through the existing appointment-scoped result token.

alter table if exists public.grooming_record_drafts
  add column if not exists care_report_observations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(care_report_observations) = 'object'),
  add column if not exists care_report_voice_transcript text not null default ''
    check (char_length(care_report_voice_transcript) <= 4000),
  add column if not exists care_report_ai_draft jsonb
    check (care_report_ai_draft is null or jsonb_typeof(care_report_ai_draft) = 'object'),
  add column if not exists care_report_generation_id uuid,
  add column if not exists care_report_owner_confirmed_at timestamptz,
  add column if not exists care_report_photo_consent boolean not null default false;

alter table if exists public.grooming_records
  add column if not exists care_report_data jsonb
    check (care_report_data is null or jsonb_typeof(care_report_data) = 'object'),
  add column if not exists care_report_observations jsonb not null default '{}'::jsonb
    check (jsonb_typeof(care_report_observations) = 'object'),
  add column if not exists care_report_generation_id uuid,
  add column if not exists care_report_owner_confirmed_at timestamptz,
  add column if not exists care_report_sent_at timestamptz,
  add column if not exists care_report_photo_consent boolean not null default false;

create table if not exists public.ai_care_report_generations (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  draft_id uuid references public.grooming_record_drafts(id) on delete set null,
  created_by_user_id uuid references auth.users(id) on delete set null,
  model text not null check (char_length(model) between 1 and 120),
  input_hash text not null check (char_length(input_hash) = 64),
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  token_usage jsonb not null default '{}'::jsonb
    check (jsonb_typeof(token_usage) = 'object'),
  estimated_cost_usd numeric(18, 8),
  status text not null default 'pending'
    check (status in ('pending', 'complete', 'error')),
  error_code text check (error_code is null or char_length(error_code) <= 120),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists ai_care_report_generations_shop_created_idx
  on public.ai_care_report_generations (shop_id, created_at desc);

create index if not exists ai_care_report_generations_appointment_created_idx
  on public.ai_care_report_generations (appointment_id, created_at desc);

alter table public.grooming_record_drafts
  add constraint grooming_record_drafts_care_report_generation_fk
  foreign key (care_report_generation_id)
  references public.ai_care_report_generations(id)
  on delete set null;

alter table public.grooming_records
  add constraint grooming_records_care_report_generation_fk
  foreign key (care_report_generation_id)
  references public.ai_care_report_generations(id)
  on delete set null;

alter table public.ai_care_report_generations enable row level security;

revoke all on table public.ai_care_report_generations from anon, authenticated;
grant all on table public.ai_care_report_generations to service_role;

notify pgrst, 'reload schema';
