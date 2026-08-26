-- Memberships are read and managed exclusively through the server-side owner APIs.
-- Keep the public table inaccessible to browser roles while allowing service_role
-- to continue its authenticated administrative access.
alter table if exists public.owner_shop_memberships enable row level security;

revoke all on table public.owner_shop_memberships from anon, authenticated;
