create role anon; create role authenticated; create role service_role;
create table public.shops(id text primary key);
create table public.guardians(id uuid primary key,shop_id text,name text,notification_settings jsonb default '{}',updated_at timestamptz default now());
create table public.pets(id uuid primary key,shop_id text,guardian_id uuid,name text);
create table public.appointments(id uuid primary key default gen_random_uuid(),shop_id text,guardian_id uuid,pet_id uuid,staff_id text,status text,source text default 'owner',start_at timestamptz,end_at timestamptz,discount_snapshot jsonb default '{}',updated_at timestamptz default now());
