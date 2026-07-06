create table if not exists public.owner_support_requests (
  id uuid primary key default gen_random_uuid(),
  shop_id text not null references public.shops(id) on delete cascade,
  owner_user_id uuid references auth.users(id) on delete set null,
  request_type text not null check (request_type in ('bug', 'improvement', 'question')),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'closed')),
  contact text not null default '',
  message text not null,
  context jsonb not null default '{}'::jsonb,
  admin_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists owner_support_requests_shop_id_created_at_idx
  on public.owner_support_requests (shop_id, created_at desc);

create index if not exists owner_support_requests_status_created_at_idx
  on public.owner_support_requests (status, created_at desc);

alter table public.owner_support_requests enable row level security;
