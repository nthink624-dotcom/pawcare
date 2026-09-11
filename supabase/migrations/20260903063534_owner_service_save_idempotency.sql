-- Persist only server-side request fingerprints so a client retry after an
-- uncertain response can safely replay the same create/update without
-- creating another service. This table intentionally stores no raw request
-- payload, customer data, or credentials.

create table if not exists public.owner_service_save_requests (
  request_id uuid primary key,
  shop_id text not null references public.shops(id) on delete cascade,
  service_id text not null,
  operation text not null check (operation in ('create', 'update')),
  payload_hash char(64) not null check (payload_hash ~ '^[0-9a-f]{64}$'),
  completed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists owner_service_save_requests_shop_created_idx
  on public.owner_service_save_requests (shop_id, created_at desc);

alter table public.owner_service_save_requests enable row level security;

revoke all on table public.owner_service_save_requests from public, anon, authenticated;
grant select, insert, update on table public.owner_service_save_requests to service_role;
