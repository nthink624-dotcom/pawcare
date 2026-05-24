-- Title: 2026-05-22 설정 페이지 저장 스키마 보강
-- Target: local/development Supabase first, then production Supabase after smoke check.
-- Purpose: 설정 페이지의 매장 프로필 이미지, 오너 알림 채널, 예약 취소 정책을 매장 단위로 저장할 수 있게 합니다.
-- Note: 매장명, 연락처, 주소, 운영시간, 정기 휴무, 승인 방식, 알림톡 사용 여부는 이미 public.shops에 있습니다.

alter table if exists public.shops
  add column if not exists profile_image_url text not null default '',
  add column if not exists owner_alert_settings jsonb not null default '{
    "channel": "app",
    "booking_request_enabled": true,
    "booking_change_enabled": true
  }'::jsonb,
  add column if not exists reservation_policy_settings jsonb not null default '{
    "cancel_window": "2h",
    "customer_change_enabled": true
  }'::jsonb;

alter table if exists public.shops
  add column if not exists booking_slot_interval_minutes integer not null default 30,
  add column if not exists booking_slot_offset_minutes integer not null default 0,
  add column if not exists notification_settings jsonb not null default '{
    "enabled": false,
    "revisit_enabled": false,
    "booking_confirmed_enabled": false,
    "booking_rejected_enabled": false,
    "booking_cancelled_enabled": false,
    "booking_rescheduled_enabled": false,
    "grooming_almost_done_enabled": false,
    "grooming_completed_enabled": false
  }'::jsonb,
  add column if not exists customer_page_settings jsonb not null default '{
    "shop_name": "",
    "tagline": "",
    "hero_image_url": "",
    "primary_color": "#1F6B5B",
    "notices": [],
    "operating_hours_note": "",
    "holiday_notice": "",
    "deposit_notice": "",
    "required_pet_fields": ["name", "breed", "weight", "age"],
    "allow_memo": true
  }'::jsonb;

alter table if exists public.shops
  drop constraint if exists shops_booking_slot_interval_minutes_check,
  drop constraint if exists shops_booking_slot_offset_minutes_check;

alter table if exists public.shops
  add constraint shops_booking_slot_interval_minutes_check
    check (booking_slot_interval_minutes in (10, 15, 20, 30, 60)),
  add constraint shops_booking_slot_offset_minutes_check
    check (booking_slot_offset_minutes >= 0 and booking_slot_offset_minutes < 60);

update public.shops
set
  owner_alert_settings = coalesce(owner_alert_settings, '{}'::jsonb) || '{
    "channel": "app",
    "booking_request_enabled": true,
    "booking_change_enabled": true
  }'::jsonb,
  reservation_policy_settings = coalesce(reservation_policy_settings, '{}'::jsonb) || '{
    "cancel_window": "2h",
    "customer_change_enabled": true
  }'::jsonb
where owner_alert_settings = '{}'::jsonb
   or reservation_policy_settings = '{}'::jsonb;

notify pgrst, 'reload schema';
