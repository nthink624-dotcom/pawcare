-- Title: Disable duplicate pending reservation holds
-- Purpose: Treat pending reservations the same as confirmed reservations for time-window capacity.

alter table if exists public.shops
  alter column reservation_policy_settings set default '{
    "cancel_window": "2h",
    "customer_change_enabled": true,
    "pending_hold_limit": 1
  }'::jsonb;

update public.shops
set reservation_policy_settings =
  jsonb_set(
    coalesce(reservation_policy_settings, '{}'::jsonb),
    '{pending_hold_limit}',
    '1'::jsonb,
    true
  );

notify pgrst, 'reload schema';
