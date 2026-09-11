-- P0: these server-only revenue and credit mutation surfaces must never be
-- reachable through the Data API with PUBLIC, anon, or authenticated grants.
-- The functions themselves intentionally remain unchanged: they already use
-- SECURITY DEFINER with an explicit public search_path, and only service_role
-- server callers are permitted to invoke them.

alter table public.shop_revenue_entries enable row level security;
revoke all on table public.shop_revenue_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.shop_revenue_entries to service_role;

revoke all on function public.grant_shop_alimtalk_credits(text, integer, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.grant_shop_alimtalk_credits(text, integer, text, text, jsonb)
  to service_role;

revoke all on function public.reset_shop_alimtalk_included_credits(text, integer, timestamptz, timestamptz, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.reset_shop_alimtalk_included_credits(text, integer, timestamptz, timestamptz, text, jsonb)
  to service_role;

revoke all on function public.consume_shop_alimtalk_credit(text, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.consume_shop_alimtalk_credit(text, uuid, uuid, text, text, jsonb)
  to service_role;

revoke all on function public.refund_shop_alimtalk_credit(text, uuid, uuid, uuid, text, text, jsonb)
  from public, anon, authenticated;
grant execute on function public.refund_shop_alimtalk_credit(text, uuid, uuid, uuid, text, text, jsonb)
  to service_role;
