# 2026-05-22 DB Rollout Matrix

이 문서는 개발 Supabase와 운영 Supabase에 어떤 SQL을 적용했는지 맞춰보기 위한 기준표입니다.

실제 비교는 `supabase/verification/20260522_dev_prod_schema_status_report.sql`을 개발과 운영에서 각각 실행한 뒤 결과를 비교합니다.

## 적용 상태 표

| 순서 | 제목 | 실행 SQL | 상태 |
| ---: | --- | --- | --- |
| 01 | 직원/근무표 스키마 보강 | `supabase/verification/20260521_staff_schema_hotfix.sql` | 확인 필요 |
| 02 | 본인확인/알림톡 크레딧 스키마 보강 | `supabase/verification/20260522_identity_alimtalk_schema_hotfix.sql` | 확인 필요 |
| 03 | 서비스/요금표 저장 스키마 보강 | `supabase/verification/20260522_service_management_schema_hotfix.sql` | 확인 필요 |
| 04 | 설정 페이지 저장 스키마 보강 | `supabase/verification/20260522_shop_settings_readiness.sql` | 확인 필요 |
| 05 | 고객 작업 메모 저장 스키마 보강 | `supabase/verification/20260522_pet_staff_notes.sql` | 확인 필요 |
| 06 | 예약 상태 변경 이력 스키마 보강 | `supabase/verification/20260522_appointment_status_events.sql` | 확인 필요 |
| 07 | 알림톡 템플릿 현황 스키마 보강 | `supabase/verification/20260522_alimtalk_template_registry.sql` | 확인 필요 |
| 08 | 고객/반려동물 라벨 스키마 보강 | `supabase/verification/20260522_customer_labels.sql` | 확인 필요 |
| 09 | 알림 발송 결과 이력 스키마 보강 | `supabase/verification/20260522_notification_delivery_audit.sql` | 확인 필요 |
| 10 | 고객 예약 변경/취소 요청 스키마 보강 | `supabase/verification/20260522_appointment_customer_requests.sql` | 확인 필요 |
| 11 | 미용 기록 사진/알림 연결 스키마 보강 | `supabase/verification/20260522_grooming_record_media_links.sql` | 확인 필요 |
| 12 | 예약 반려동물 참여자 스키마 보강 | `supabase/verification/20260522_appointment_pet_participants.sql` | 확인 필요 |
| 13 | 고객 검색 프로필 스키마 보강 | `supabase/verification/20260522_customer_search_profiles.sql` | 확인 필요 |
| 14 | 예약 상태 동기화 메타데이터 스키마 보강 | `supabase/verification/20260522_appointment_status_sync_metadata.sql` | 확인 필요 |
| 15 | 오너 운영 변경 이력 스키마 보강 | `supabase/verification/20260522_owner_activity_events.sql` | 확인 필요 |
| 16 | 예약 계산 기본 단위 15분 전환 | `supabase/verification/20260522_booking_slot_15_minute_default.sql` | 다음 적용 후보 |
| 17 | 예약 담당자 시간 겹침 방지 스키마 보강 | `supabase/verification/20260522_appointment_staff_overlap_guard.sql` | 보류 |

## 보류 기준

`예약 담당자 시간 겹침 방지 스키마 보강`은 아래를 먼저 확인한 뒤 적용합니다.

1. `예약 계산 기본 단위 15분 전환` 적용
2. 고객 예약 시간 선택 UI 정리
3. 기존 예약 겹침 조회
4. 기존 겹침이 없거나 정리 완료

## 제목 통일 기준

Supabase SQL Editor 제목은 표의 `제목` 컬럼을 그대로 사용합니다.

`supabase/migrations` 첫 줄 제목도 같은 한국어 제목으로 통일했습니다.
