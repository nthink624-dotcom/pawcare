alter table if exists shops
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
    "parking_notice": "",
    "kakao_inquiry_url": "",
    "show_notices": true,
    "show_parking_notice": true,
    "show_services": true,
    "booking_button_label": "예약하기",
    "show_kakao_inquiry": true,
    "font_preset": "soft",
    "font_scale": "comfortable"
  }'::jsonb;
