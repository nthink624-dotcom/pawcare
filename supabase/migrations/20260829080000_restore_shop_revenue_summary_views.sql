-- Restores the two canonical revenue projections before the later
-- 20260829084203_harden_sensitive_database_permissions migration grants
-- service_role-only access.  The SELECT definitions below intentionally
-- match 202605180006_shop_revenue_ledger.sql.

create or replace view public.shop_revenue_daily_summary as
select
  shop_id,
  entry_date,
  count(*) filter (where status not in ('cancelled', 'void')) as entry_count,
  coalesce(sum(gross_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as gross_amount,
  coalesce(sum(discount_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as discount_amount,
  coalesce(sum(refund_amount) filter (where status not in ('cancelled', 'void')), 0)::integer as refund_amount,
  coalesce(sum(net_amount) filter (where status in ('paid', 'partially_refunded', 'refunded')), 0)::integer as paid_net_amount,
  coalesce(sum(net_amount) filter (where status = 'expected'), 0)::integer as expected_net_amount,
  coalesce(sum(net_amount) filter (where status = 'unpaid'), 0)::integer as unpaid_net_amount
from public.shop_revenue_entries
group by shop_id, entry_date;

create or replace view public.shop_revenue_service_summary as
select
  revenue.shop_id,
  revenue.service_id,
  coalesce(services.name, revenue.title, 'Uncategorized') as service_name,
  count(*) filter (where revenue.status not in ('cancelled', 'void')) as entry_count,
  coalesce(sum(revenue.net_amount) filter (where revenue.status in ('paid', 'partially_refunded', 'refunded')), 0)::integer as paid_net_amount,
  coalesce(sum(revenue.net_amount) filter (where revenue.status = 'expected'), 0)::integer as expected_net_amount,
  coalesce(sum(revenue.net_amount) filter (where revenue.status = 'unpaid'), 0)::integer as unpaid_net_amount,
  min(revenue.entry_date) as first_entry_date,
  max(revenue.entry_date) as last_entry_date
from public.shop_revenue_entries revenue
left join public.services on services.id = revenue.service_id
group by revenue.shop_id, revenue.service_id, coalesce(services.name, revenue.title, 'Uncategorized');

-- Views are in the exposed public schema.  Keep browser roles fail-closed
-- even if this repair is applied before the later hardening migration.
revoke all on table public.shop_revenue_daily_summary from public, anon, authenticated;
grant select on table public.shop_revenue_daily_summary to service_role;

revoke all on table public.shop_revenue_service_summary from public, anon, authenticated;
grant select on table public.shop_revenue_service_summary to service_role;
