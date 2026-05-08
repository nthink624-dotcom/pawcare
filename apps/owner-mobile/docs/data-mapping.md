# Owner Mobile Data Mapping

이 문서는 `D:\petmanager` 기존 웹 오너 화면을 기준으로 `apps/owner-mobile` 앱 화면이 앞으로 어떤 데이터 필드에 연결되어야 하는지 정리한다. 현재 단계에서는 Supabase/API/session/write 기능을 구현하지 않고, 화면별 읽기 모델과 이후 쓰기 항목만 분리한다.

## 참고 기준본

- `D:\petmanager\src\types\domain.ts`
- `D:\petmanager\src\server\bootstrap.ts`
- `D:\petmanager\src\server\schemas.ts`
- `D:\petmanager\src\server\owner-mutations.ts`
- `D:\petmanager\src\components\owner\owner-app.tsx`
- `D:\petmanager\src\components\owner\owner-settings-panel.tsx`
- `D:\petmanager\src\lib\owner-home-copy.ts`
- `D:\petmanager\src\components\owner-web\reservation-management-screen.tsx`
- `D:\petmanager\src\components\owner-web\customer-management-screen.tsx`
- `D:\petmanager\src\components\owner-web\owner-web-data.ts`

## 기준 응답 모델

기존 웹 오너 화면의 주 데이터 단위는 `BootstrapPayload`다. 서버에서는 `/api/bootstrap?shopId=...`가 다음 필드를 묶어서 내려준다.

| 영역 | 기존 웹 타입 | 주요 필드 |
| --- | --- | --- |
| 매장 | `Shop` | `id`, `owner_user_id`, `name`, `phone`, `address`, `description`, `business_hours`, `regular_closed_days`, `temporary_closed_dates`, `concurrent_capacity`, `booking_slot_interval_minutes`, `booking_slot_offset_minutes`, `approval_mode`, `notification_settings`, `customer_page_settings` |
| 고객/보호자 | `Guardian` | `id`, `shop_id`, `name`, `phone`, `memo`, `notification_settings`, `deleted_at`, `deleted_restore_until`, `created_at`, `updated_at` |
| 반려동물 | `Pet` | `id`, `shop_id`, `guardian_id`, `name`, `breed`, `weight`, `age`, `notes`, `birthday`, `grooming_cycle_weeks`, `avatar_seed` |
| 서비스 | `Service` | `id`, `shop_id`, `name`, `price`, `price_type`, `duration_minutes`, `is_active` |
| 예약 | `Appointment` | `id`, `shop_id`, `guardian_id`, `pet_id`, `service_id`, `appointment_date`, `appointment_time`, `status`, `memo`, `rejection_reason`, `start_at`, `end_at`, `source` |
| 미용 기록 | `GroomingRecord` | `id`, `shop_id`, `guardian_id`, `pet_id`, `service_id`, `appointment_id`, `style_notes`, `memo`, `price_paid`, `groomed_at` |
| 알림 | `Notification` | `id`, `shop_id`, `appointment_id`, `pet_id`, `guardian_id`, `type`, `channel`, `message`, `status`, `sent_at`, `created_at` |

`bootstrap.ts`는 삭제된 고객을 `deletedGuardians`로 분리하고, 활성 고객/반려동물 기준으로 `appointments`, `groomingRecords`, `notifications`를 필터링한다. 앱도 같은 정책을 따라야 한다.

## 예약 상태값

기존 실제 상태값은 영어 enum이다.

| 실제 상태값 | 앱 표시 라벨 | 홈/예약조회 분류 |
| --- | --- | --- |
| `pending` | 승인 대기 | 승인 대기 |
| `confirmed` | 확정 | 예약 현황 |
| `in_progress` | 진행 중 | 예약 현황 |
| `almost_done` | 픽업 준비 | 예약 현황 |
| `completed` | 완료 | 완료 내역 |
| `cancelled` | 취소 | 취소·변경 |
| `rejected` | 거절 | 취소·변경 또는 별도 거절 |
| `noshow` | 노쇼 | 취소·변경 또는 별도 미방문 |

현재 앱 placeholder는 한국어 라벨을 `status` 자체로 저장한다. 실제 연결 시에는 `Appointment.status`를 원본으로 유지하고, 화면에서만 라벨/색상으로 변환해야 한다.

## 화면별 데이터 매핑

### LoginScreen

| 앱 표시/동작 | 현재 placeholder | 실제 연결 후보 |
| --- | --- | --- |
| 로그인 제목/설명 | 정적 문구 | 기존 `MobileLoginScreenTemplate` 문구 유지 |
| 아이디/비밀번호 | disabled input | 실제 구현 단계에서 `loginId`, `password` local state |
| 아이디 저장 | local checkbox state | 실제 구현 단계에서 local storage/secure storage |
| 카카오/네이버/Google 버튼 | mock sign in | 실제 구현 단계에서 기존 Supabase OAuth 흐름 |
| 로그인 버튼 | mock sign in | 실제 구현 단계에서 Supabase session |

이번 문서 단계에서는 실제 session 구현 대상이 아니다.

### TodayHomeScreen

| 앱 표시/계산 | 현재 placeholder | 실제 필드/계산 |
| --- | --- | --- |
| 매장명 | `shopSummary.name` | `BootstrapPayload.shop.name` |
| 예약 링크 복사 | 버튼만 표시 | `shop.id` 기반 `/entry/{shop.id}` 또는 앱 공유 링크 |
| 승인 대기 카드 | `reservationRows.status === "승인 대기"` | `appointments` 중 `appointment_date === today` and `status === "pending"` |
| 예약 현황 카드 | `"확정"`, `"진행 중"`, `"픽업 준비"` | `status in ["confirmed", "in_progress", "almost_done"]` |
| 완료 내역 카드 | `"완료"` | `status === "completed"` plus 당일 `groomingRecords` |
| 취소·변경 카드 | `"취소"` | `status in ["cancelled", "rejected", "noshow"]` |
| 예약 행의 펫/고객/서비스 | flat string | `Appointment.pet_id -> Pet`, `guardian_id -> Guardian`, `service_id -> Service` join |
| 소요 시간 | 미표시 또는 string | `Service.duration_minutes` |

오늘 홈은 `owner-app.tsx`처럼 `appointments`, `pets`, `guardians`, `services`, `groomingRecords`를 join해서 계산해야 한다.

### ReservationListScreen

| 앱 표시/계산 | 현재 placeholder | 실제 필드/계산 |
| --- | --- | --- |
| 날짜 선택 | 고정 quick date | `selectedDate`, `appointment_date`, 빠른 날짜 배열 |
| 검색 | disabled input | 고객명 `Guardian.name`, 전화 `Guardian.phone`, 반려동물명 `Pet.name` |
| 상태 필터 | 정적 chip | `Appointment.status` 기반 필터 |
| 예약 섹션 | `reservationRows` | 선택 날짜의 `appointments` join rows |
| 완료 내역 | status label `"완료"` | `Appointment.status === "completed"` and `GroomingRecord` |
| 취소·변경 내역 | status label `"취소"` | `cancelled`, `rejected`, `noshow` |
| 상세 이동 ID | placeholder `reservation.id` | `Appointment.id` |

읽기 연결 시 `AppointmentRowViewModel` 같은 화면 전용 모델을 만들어 join 결과를 넘기는 것이 안전하다.

### ReservationDetailScreen

| 앱 표시 | 현재 placeholder | 실제 필드 |
| --- | --- | --- |
| 예약 ID | `OwnerReservation.id` | `Appointment.id` |
| 시간 | `time` | `appointment_date`, `appointment_time`, `start_at`, `end_at` |
| 고객/보호자 | `customer` | `Guardian.name`, `Guardian.phone` |
| 반려동물 | `pet` | `Pet.name`, `Pet.breed`, `Pet.notes`, `Pet.avatar_seed` |
| 서비스 | `service` | `Service.name`, `Service.duration_minutes`, `Service.price`, `Service.price_type` |
| 상태 | Korean label | `Appointment.status` mapped label |
| 담당 | `staff` placeholder | 현재 실제 domain에는 담당자 필드 없음 |
| 채널 | `channel` placeholder | `Appointment.source` 또는 향후 접수 채널 필드 필요 |
| 메모 | `note` | `Appointment.memo`, `Appointment.rejection_reason` |
| 빠른 연락 | `phone` | `Guardian.phone` |

`staff`와 `channel`은 기존 웹 preview 데이터에는 있지만 실제 `Appointment` 타입에는 없다. 실제 연결 시 그대로 요구하면 필드가 없으므로 placeholder 유지, 파생 표시, 또는 DB/API 확장이 필요하다.

### CustomerListScreen

| 앱 표시/계산 | 현재 placeholder | 실제 필드/계산 |
| --- | --- | --- |
| 고객명 | `OwnerCustomer.name` | `Guardian.name` |
| 전화번호 | `phone` | `Guardian.phone` |
| 반려동물 목록 | `pets: string[]` | `pets.filter(pet.guardian_id === guardian.id)` |
| 태그 | `tags` placeholder | 실제 domain에는 고객 tag 필드 없음 |
| 최근 방문 | `recentVisit` string | 해당 guardian pet들의 최신 `GroomingRecord.groomed_at` |
| 다음 예약 | `nextBooking` string | 해당 guardian pet들의 미래 `Appointment` 중 가장 빠른 건 |
| 알림 상태 | `alerts` string | `Guardian.notification_settings.enabled`, `revisit_enabled` |
| 삭제 모드 | 버튼만 표시 | `Guardian.deleted_at`, `deleted_restore_until`, 삭제/복구 mutation은 나중 |

`tags`는 실제 데이터에 없으므로 초기에 계산 태그로만 처리한다. 예: 신규, 정기 고객, 재방문 임박, 상담 필요.

### CustomerDetailScreen

| 앱 표시 | 현재 placeholder | 실제 필드 |
| --- | --- | --- |
| 고객 기본 정보 | `OwnerCustomer` | `Guardian.id`, `name`, `phone`, `memo`, `notification_settings` |
| 반려동물 카드 | pet name strings | `Pet.id`, `name`, `breed`, `birthday`, `weight`, `age`, `notes`, `grooming_cycle_weeks`, `avatar_seed` |
| 고객 메모 | `memo` | `Guardian.memo` |
| 알림 상태 | `alerts` | `Guardian.notification_settings.enabled`, `revisit_enabled` |
| 예약 내역 | reservationRows by customer name | `Appointment.guardian_id` and `Pet.guardian_id` |
| 미용 기록 | 미구현 | `GroomingRecord` joined with `Pet`, `Service` |
| 알림 내역 | 미구현 | `Notification.guardian_id`, `pet_id`, `appointment_id` |

고객 상세는 join이 많으므로 `guardianId` 기준으로 `pets`, `appointments`, `groomingRecords`, `notifications`를 묶은 상세 view model을 만드는 것이 좋다.

### SettingsScreen

| 앱 표시 | 현재 placeholder | 실제 필드 |
| --- | --- | --- |
| 매장 기본 정보 | `shopSummary` | `Shop.name`, `phone`, `address`, `description`, `customer_page_settings.hero_image_url` |
| 안내 문구 | 정적 설명 | `Shop.customer_page_settings.notices`, `parking_notice`, `operating_hours_note`, `holiday_notice`, show flags |
| 운영 시간 | row placeholder | `Shop.business_hours`, `regular_closed_days`, `temporary_closed_dates` |
| 예약 정책 | row placeholder | `Shop.concurrent_capacity`, `booking_slot_interval_minutes`, `booking_slot_offset_minutes`, `approval_mode` |
| 알림 설정 | row placeholder | `Shop.notification_settings` |
| 서비스 관리 | row placeholder | `Service[]` with `name`, `price`, `duration_minutes`, `is_active` |
| 결제 설정 | row placeholder | `OwnerSubscriptionSummary` from `/api/subscription` |
| 계정 | `ownerEmail` placeholder | session user email plus owner profile/subscription identity |

설정은 읽기 연결과 쓰기 연결의 위험도가 가장 크다. 첫 단계에서는 요약 표시만 연결하고 저장 UI는 disabled/placeholder로 유지한다.

## 현재 placeholder와 실제 데이터의 차이

| 현재 앱 placeholder | 실제 데이터 |
| --- | --- |
| 예약, 고객, 매장 정보가 `ownerPlaceholderData.ts`에 flat string으로 존재 | `BootstrapPayload`의 `shop`, `guardians`, `pets`, `services`, `appointments`, `groomingRecords`, `notifications`를 join해야 함 |
| 예약 상태가 한국어 라벨 | 실제 `Appointment.status`는 영어 enum |
| 고객 `tags`, 예약 `staff`, 예약 `channel`이 직접 필드 | 실제 domain에는 해당 직접 필드 없음 |
| 고객 최근 방문/다음 예약이 문자열 | 실제로는 `GroomingRecord`와 `Appointment`에서 계산 |
| 로그인은 `MOCK_OWNER_SESSION` | 실제 Supabase session/user/shop ownership 확인 필요 |
| `apiClient.ready === false` | 실제 API client 없음 |

## 읽기 전용 연결 우선순위

1. `Shop` 요약: `TodayHomeScreen`, `SettingsScreen`의 매장명/주소/기본 설정 표시
2. 예약 목록 read model: `ReservationListScreen`에서 `Appointment + Guardian + Pet + Service` join
3. 오늘 홈 계산: 같은 예약 read model을 재사용해서 통계와 당일 섹션 계산
4. 예약 상세: `Appointment.id` route param 기반 상세 표시
5. 고객 목록 read model: `Guardian + Pet + latest GroomingRecord + next Appointment`
6. 고객 상세: 고객별 pets, appointments, groomingRecords, notifications 표시
7. 설정 요약: 저장 없이 shop/customer page/service/notification/subscription 요약만 표시

## 나중에 붙일 쓰기 기능

- 실제 로그인/session 생성, 저장, 복구, 로그아웃
- 예약 생성: `appointmentInputSchema`, `createAppointment`
- 예약 상태 변경: `appointmentStatusSchema`, `updateAppointmentStatus`
- 예약 일정/서비스/메모 수정: `appointmentEditSchema`
- 고객 생성/수정/삭제/복구: `guardianInputSchema`, `guardianUpdateSchema`, `guardianDeleteSchema`, `guardianRestoreSchema`
- 반려동물 생성/수정: `petInputSchema`, `petUpdateSchema`
- 서비스 생성/수정: `serviceInputSchema`
- 매장/운영/예약정책/알림 설정 저장: `shopSettingsSchema`
- 고객 예약 화면 설정 저장: `customerPageSettingsSchema`
- 알림톡/푸시 발송, 재방문/생일/예약 리마인더 발송
- 결제/구독 변경

## 위험 요소

- `D:\petmanager` 기존 웹 repo와 `D:\petmanager-app` 앱 repo가 분리되어 있으므로 타입 복사/중복이 쉽게 어긋날 수 있다.
- `BootstrapPayload`를 그대로 앱에 가져오면 앱 번들에 서버 전용 가정이 섞일 수 있다. 앱에는 API 응답 DTO 타입만 별도로 두는 편이 안전하다.
- `Appointment.status` 라벨 변환을 화면마다 중복하면 상태 추가 시 누락이 생긴다.
- `staff`, `channel`, `tags`는 preview 데이터에는 있지만 실제 domain에는 없으므로 실제 연결 시 사라지거나 계산 규칙이 필요하다.
- 설정 쓰기는 영업시간, 휴무, 슬롯 간격, 동시 수용 인원에 따라 예약 가능 시간 계산에 영향을 준다.
- 예약 상태 변경은 알림톡 발송과 `GroomingRecord` 생성 같은 부수효과가 있으므로 앱에서 직접 DB write를 하면 안 된다.
- 삭제 고객은 `deleted_at`, `deleted_restore_until` 정책이 있어 목록 필터와 복구 가능 기간을 함께 다뤄야 한다.
- 알림 설정은 shop-level과 guardian-level이 모두 있어 화면에서 단일 toggle처럼 보여도 실제 적용 기준이 다층이다.

## 다음 구현 단계 제안

1. 앱 내부에 실제 API를 호출하지 않는 DTO 타입 파일을 만든다. 예: `src/types/bootstrap.ts`.
2. `ownerPlaceholderData.ts`를 실제 `BootstrapPayload` 형태에 가까운 mock으로 재구성한다.
3. `AppointmentViewModel`, `CustomerSummaryViewModel`, `CustomerDetailViewModel` 변환 함수를 만든다.
4. 화면은 view model만 받도록 정리하고, placeholder source와 미래 API source를 교체 가능하게 만든다.
5. 그 다음 단계에서 read-only API client를 추가하고 `Shop -> ReservationList -> TodayHome -> ReservationDetail -> CustomerList -> CustomerDetail -> Settings summary` 순서로 연결한다.
