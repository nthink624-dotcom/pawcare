-- Restore the server-only boundaries that were missing from the production
-- migration history after recovery, and make the remaining exposed views and
-- media metering RPC obey caller permissions.

alter table public.shop_revenue_entries enable row level security;
revoke all on table public.shop_revenue_entries from public, anon, authenticated;
grant select, insert, update, delete on table public.shop_revenue_entries to service_role;

alter view public.customer_search_profiles set (security_invoker = true);
revoke all on table public.customer_search_profiles from public, anon, authenticated;
grant select on table public.customer_search_profiles to service_role;

alter view public.shop_alimtalk_credit_summaries set (security_invoker = true);
revoke all on table public.shop_alimtalk_credit_summaries from public, anon, authenticated;
grant select on table public.shop_alimtalk_credit_summaries to service_role;

alter function public.increment_shop_media_usage(text, date, integer, bigint, integer, bigint)
  set search_path = pg_catalog, public;
revoke all on function public.increment_shop_media_usage(text, date, integer, bigint, integer, bigint)
  from public, anon, authenticated;
grant execute on function public.increment_shop_media_usage(text, date, integer, bigint, integer, bigint)
  to service_role;

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

notify pgrst, 'reload schema';
