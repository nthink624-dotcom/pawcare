alter table public.shop_identity_change_events enable row level security;
revoke all on table public.shop_identity_change_events from anon, authenticated;
