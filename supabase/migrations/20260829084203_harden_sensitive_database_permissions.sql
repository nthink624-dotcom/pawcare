alter table public.shop_revenue_entries enable row level security;

revoke all on table public.shop_revenue_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.shop_revenue_entries to service_role;

revoke all on table public.shop_revenue_daily_summary from public, anon, authenticated;
grant select on table public.shop_revenue_daily_summary to service_role;

revoke all on table public.shop_revenue_service_summary from public, anon, authenticated;
grant select on table public.shop_revenue_service_summary to service_role;

revoke all on table public.customer_search_profiles from public, anon, authenticated;
grant select on table public.customer_search_profiles to service_role;

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
