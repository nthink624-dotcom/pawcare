-- Title: 2026-05-22 개발/운영 스키마 적용 상태 비교 리포트
-- Target: run separately in local/development Supabase and production Supabase.
-- Purpose: Show whether each rollout item has been applied. This SQL is read-only.

with checks as (
  select 10 as sort_order, '직원/근무표 스키마 보강' as title, 'table: staff_members' as item,
    (to_regclass('public.staff_members') is not null) as applied,
    'required before staff UI/API works' as note
  union all
  select 11, '직원/근무표 스키마 보강', 'table: staff_schedule_overrides',
    (to_regclass('public.staff_schedule_overrides') is not null),
    'required before staff weekly schedule persists'
  union all
  select 12, '직원/근무표 스키마 보강', 'column: appointments.staff_id',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments' and column_name = 'staff_id'
    ),
    'required before schedule staff assignment persists'

  union all
  select 20, '본인확인/알림톡 크레딧 스키마 보강', 'table: owner_identity_verifications',
    (to_regclass('public.owner_identity_verifications') is not null),
    'required for PASS/KCP verification requests'
  union all
  select 21, '본인확인/알림톡 크레딧 스키마 보강', 'table: shop_alimtalk_credit_balances',
    (to_regclass('public.shop_alimtalk_credit_balances') is not null),
    'required for per-shop Alimtalk balance'
  union all
  select 22, '본인확인/알림톡 크레딧 스키마 보강', 'table: shop_alimtalk_credit_events',
    (to_regclass('public.shop_alimtalk_credit_events') is not null),
    'required for credit ledger'

  union all
  select 30, '서비스/요금표 저장 스키마 보강', 'column: services.category',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'services' and column_name = 'category'
    ),
    'service metadata'
  union all
  select 31, '서비스/요금표 저장 스키마 보강', 'table: shop_service_guides',
    (to_regclass('public.shop_service_guides') is not null),
    'service guide rows'

  union all
  select 40, '설정 페이지 저장 스키마 보강', 'column: shops.profile_image_url',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'shops' and column_name = 'profile_image_url'
    ),
    'shop profile image URL'
  union all
  select 41, '설정 페이지 저장 스키마 보강', 'column: shops.owner_alert_settings',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'shops' and column_name = 'owner_alert_settings'
    ),
    'owner alert settings'
  union all
  select 42, '설정 페이지 저장 스키마 보강', 'column: shops.reservation_policy_settings',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'shops' and column_name = 'reservation_policy_settings'
    ),
    'reservation policy settings'

  union all
  select 50, '고객 작업 메모 저장 스키마 보강', 'table: pet_staff_notes',
    (to_regclass('public.pet_staff_notes') is not null),
    'shared staff/customer work memo persistence'

  union all
  select 60, '예약 상태 변경 이력 스키마 보강', 'table: appointment_status_events',
    (to_regclass('public.appointment_status_events') is not null),
    'status event history'
  union all
  select 61, '예약 상태 변경 이력 스키마 보강', 'table: appointment_status_event_media',
    (to_regclass('public.appointment_status_event_media') is not null),
    'status event photo links'

  union all
  select 70, '알림톡 템플릿 현황 스키마 보강', 'table: platform_alimtalk_templates',
    (to_regclass('public.platform_alimtalk_templates') is not null),
    'Ssodaa/Kakao template state'
  union all
  select 71, '알림톡 템플릿 현황 스키마 보강', 'table: platform_alimtalk_template_events',
    (to_regclass('public.platform_alimtalk_template_events') is not null),
    'template state history'

  union all
  select 80, '고객/반려동물 라벨 스키마 보강', 'table: guardian_labels',
    (to_regclass('public.guardian_labels') is not null),
    'customer labels'
  union all
  select 81, '고객/반려동물 라벨 스키마 보강', 'table: pet_labels',
    (to_regclass('public.pet_labels') is not null),
    'pet labels'

  union all
  select 90, '알림 발송 결과 이력 스키마 보강', 'table: notification_delivery_checks',
    (to_regclass('public.notification_delivery_checks') is not null),
    'provider delivery lookup history'
  union all
  select 91, '알림 발송 결과 이력 스키마 보강', 'column: notifications.credit_consume_event_id',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'notifications' and column_name = 'credit_consume_event_id'
    ),
    'connect notification to credit consume event'

  union all
  select 100, '고객 예약 변경/취소 요청 스키마 보강', 'table: appointment_customer_requests',
    (to_regclass('public.appointment_customer_requests') is not null),
    'customer-originated change/cancel requests'

  union all
  select 110, '미용 기록 사진/알림 연결 스키마 보강', 'column: grooming_records.before_media_asset_id',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'grooming_records' and column_name = 'before_media_asset_id'
    ),
    'grooming before photo link'
  union all
  select 111, '미용 기록 사진/알림 연결 스키마 보강', 'column: grooming_records.after_media_asset_id',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'grooming_records' and column_name = 'after_media_asset_id'
    ),
    'grooming after photo link'

  union all
  select 120, '예약 반려동물 참여자 스키마 보강', 'table: appointment_pet_participants',
    (to_regclass('public.appointment_pet_participants') is not null),
    'multi-pet appointment participants'

  union all
  select 130, '고객 검색 프로필 스키마 보강', 'view: customer_search_profiles',
    (to_regclass('public.customer_search_profiles') is not null),
    'owner-side customer search/disambiguation'

  union all
  select 140, '예약 상태 동기화 메타데이터 스키마 보강', 'column: appointments.status_changed_at',
    exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'appointments' and column_name = 'status_changed_at'
    ),
    'PC/mobile status sync pointer'
  union all
  select 141, '예약 상태 동기화 메타데이터 스키마 보강', 'constraint: appointments_status_check includes rejected',
    exists (
      select 1
      from pg_constraint
      where conrelid = 'public.appointments'::regclass
        and conname = 'appointments_status_check'
        and pg_get_constraintdef(oid) like '%rejected%'
    ),
    'DB must accept rejected status'

  union all
  select 150, '오너 운영 변경 이력 스키마 보강', 'table: owner_activity_events',
    (to_regclass('public.owner_activity_events') is not null),
    'owner-side operation audit log'

  union all
  select 160, '예약 계산 기본 단위 15분 전환', 'default: shops.booking_slot_interval_minutes = 15',
    exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'shops'
        and column_name = 'booking_slot_interval_minutes'
        and column_default like '15%'
    ),
    'apply before overlap trigger and customer time UI cleanup'
  union all
  select 161, '예약 계산 기본 단위 15분 전환', 'data: shops using 30 minute default converted',
    not exists (
      select 1
      from public.shops
      where booking_slot_interval_minutes = 30
    ),
    '30-minute shops should only remain if intentionally kept before applying SQL'

  union all
  select 170, '예약 담당자 시간 겹침 방지 스키마 보강', 'view: appointment_staff_overlap_conflicts',
    (to_regclass('public.appointment_staff_overlap_conflicts') is not null),
    'HOLD until 15-minute default and existing overlap check are done'
  union all
  select 171, '예약 담당자 시간 겹침 방지 스키마 보강', 'trigger: appointments_prevent_staff_overlap',
    exists (
      select 1
      from information_schema.triggers
      where event_object_schema = 'public'
        and event_object_table = 'appointments'
        and trigger_name = 'appointments_prevent_staff_overlap'
    ),
    'HOLD until safe to enforce'
)
select
  sort_order,
  title,
  item,
  case when applied then 'OK' else 'MISSING' end as status,
  note
from checks
order by sort_order, item;
