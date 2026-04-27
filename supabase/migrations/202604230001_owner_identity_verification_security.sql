create table if not exists owner_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  purpose text not null check (purpose in ('signup', 'reset-password', 'find-login-id')),
  verification_method text not null check (verification_method in ('local', 'portone')),
  status text not null default 'requested' check (status in ('requested', 'verified', 'consumed', 'failed')),
  name text not null,
  birth_date text not null,
  phone_number text not null,
  challenge_code_hash text,
  challenge_expires_at timestamptz,
  verification_attempt_count int not null default 0,
  verification_token_id uuid,
  verified_at timestamptz,
  verified_expires_at timestamptz,
  consumed_at timestamptz,
  consumed_action text,
  provider_identity_verification_id text,
  provider_status text,
  provider_customer_id text,
  provider_customer_name text,
  provider_customer_phone_number text,
  provider_customer_birth_date text,
  ci text,
  di text,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists owner_identity_verifications_provider_identity_verification_id_key
  on owner_identity_verifications(provider_identity_verification_id)
  where provider_identity_verification_id is not null;

create index if not exists owner_identity_verifications_status_idx
  on owner_identity_verifications(status, verified_expires_at desc, challenge_expires_at desc);

create index if not exists owner_identity_verifications_purpose_idx
  on owner_identity_verifications(purpose, created_at desc);
