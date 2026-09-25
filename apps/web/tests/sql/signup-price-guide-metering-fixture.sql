\set ON_ERROR_STOP on

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end;
$$;

create table public.signup_price_guide_analysis_requests (
  token_jti uuid primary key,
  ip_hash text,
  session_hash text,
  device_hash text,
  file_hash text,
  status text not null check (status in ('processing', 'completed', 'failed', 'tombstoned')),
  estimated_cost_microusd integer not null default 0,
  actual_cost_microusd integer,
  cache_source_jti uuid,
  cache_ciphertext text,
  cache_expires_at timestamptz,
  failure_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  purge_requested_at timestamptz,
  purged_at timestamptz,
  purge_reason text,
  cleanup_after timestamptz,
  cleanup_attempts integer not null default 0,
  cleanup_last_error text
);

create or replace function public.claim_signup_price_guide_analysis_v1(uuid, text, text, text, text, integer, integer)
returns jsonb language sql as $$ select '{}'::jsonb $$;
create or replace function public.purge_signup_price_guide_analysis_v1(uuid, text, text)
returns boolean language sql as $$ select true $$;
create or replace function public.cleanup_signup_price_guide_analysis_v1(integer)
returns jsonb language sql as $$ select '{}'::jsonb $$;

