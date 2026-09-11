-- Bind each PortOne verification result to the exact server-created request.
-- This migration is source-only until the Development and Production rollout is separately approved.

alter table public.owner_identity_verifications
  add column if not exists provider_request_state_hash text,
  add column if not exists provider_request_expires_at timestamptz;

-- Requests issued before this contract cannot prove the new binding. Fail closed
-- instead of allowing an old provider id to mint a new verification token.
update public.owner_identity_verifications
set
  status = 'failed',
  verification_token_id = null,
  verified_expires_at = null,
  failure_reason = 'provider_request_binding_migration_invalidated',
  updated_at = now()
where verification_method = 'portone'
  and status in ('requested', 'verified')
  and (
    provider_identity_verification_id is null
    or provider_request_state_hash is null
    or provider_request_expires_at is null
  );

alter table public.owner_identity_verifications
  drop constraint if exists owner_identity_verifications_portone_request_binding_check;

alter table public.owner_identity_verifications
  add constraint owner_identity_verifications_portone_request_binding_check
  check (
    verification_method <> 'portone'
    or status in ('consumed', 'failed')
    or (
      provider_identity_verification_id is not null
      and provider_request_state_hash ~ '^[a-f0-9]{64}$'
      and provider_request_expires_at is not null
    )
  ) not valid;

alter table public.owner_identity_verifications
  validate constraint owner_identity_verifications_portone_request_binding_check;

comment on column public.owner_identity_verifications.provider_request_state_hash is
  'SHA-256 hash of the one-time browser state bound to the server-created PortOne request';

comment on column public.owner_identity_verifications.provider_request_expires_at is
  'Expiry for the exact request/provider/state binding; expired bindings cannot mint tokens';
