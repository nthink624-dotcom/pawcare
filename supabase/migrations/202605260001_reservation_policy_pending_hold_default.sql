-- Title: 2026-05-26 예약 정책 승인대기 기본값 보강
-- Purpose: New and legacy shops default to direct approval with up to two pending holds.

alter table if exists public.shops
  alter column reservation_policy_settings set default '{
    "cancel_window": "2h",
    "customer_change_enabled": true,
    "pending_hold_limit": 2
  }'::jsonb;

update public.shops
set reservation_policy_settings = coalesce(reservation_policy_settings, '{}'::jsonb) || '{
  "pending_hold_limit": 2
}'::jsonb
where not coalesce(reservation_policy_settings, '{}'::jsonb) ? 'pending_hold_limit';

notify pgrst, 'reload schema';
