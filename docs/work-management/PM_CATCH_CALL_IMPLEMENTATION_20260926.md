# 캐치콜 구현 작업서 — 2026-09-26

## 이번 단계에서 시작한 범위

- 기존 오너 개인 휴대폰·매장번호를 교체하지 않는 provider-neutral 통화 이벤트 계약을 유지한다.
- 매칭된 `call_events`에 오너가 선택한 반려동물·서비스·일시를 연결해 `appointments.source = 'catchcall'`로 저장한다.
- 예약 생성 시 일반 예약확정 알림톡을 자동 발송하지 않는다.
- 통화 이벤트가 이미 `ended`이면 예약 연결 커밋 뒤 예약확정 알림톡을 한 번만 시도한다.
- `incoming/answered`로 먼저 예약을 저장한 경우, 같은 `providerCallId`의 `ended` 이벤트가 들어올 때 알림톡을 처리한다.
- 원번호 원문·녹음·전사·공급사 원본 payload는 저장하거나 반환하지 않는다.

## 구현 파일

- `apps/shared/contracts/catch-call.ts`: PC·모바일 상태/요청/응답 계약
- `supabase/migrations/20260926130000_catch_call_reservation_flow.sql`: 예약 연결·알림 상태 컬럼과 예약 source 확장 (검토용, 미적용)
- `apps/web/src/app/api/owner/call-events/[eventId]/reservation/route.ts`
- `apps/mobile/src/app/api/owner/call-events/[eventId]/reservation/route.ts`
- `apps/web/src/app/api/owner/call-events/route.ts`
- `apps/mobile/src/app/api/owner/call-events/route.ts`
- `apps/mobile/src/components/owner/owner-catch-call-panel.tsx`: 통화 목록·보호자 매칭 예약 입력·알림 상태 UI
- `apps/mobile/src/components/owner/owner-settings-panel.tsx`, `owner-app.tsx`: 설정 메뉴와 화면 라우팅 연결
- `apps/web/src/server/catch-call.ts`: 종료 이벤트 연결 및 중복 발송 방지

## 다음 단계

1. Android `CallScreeningService` 어댑터를 실제 기기에서 검증한다. OS 권한/기본 앱 선택이 필요한 별도 단계다.
2. iOS Live Caller ID/전화 종료 이벤트 제공 범위를 별도 네이티브 프로젝트에서 검증한다. 현재 저장소에는 iOS Capacitor 플랫폼이 없다.
3. 개발 Supabase에 적용하기 전 마이그레이션 dry-run과 대표 승인 후 readback을 수행한다.

## 완료 조건

- 매칭된 통화 이벤트에서 같은 예약 요청을 재시도해도 예약·알림톡이 중복 생성되지 않는다.
- 미매칭·부재중·일반 통화에는 예약확정 알림톡을 보내지 않는다.
- 알림톡 공급사 실패는 `failed`로 남고 성공으로 가장하지 않는다.
- 웹·모바일 타입 검사와 캐치콜 계약 검사가 통과한다.

## Automation-first Android milestone (2026-09-27)

- Added the Android `CallScreeningService` adapter and Capacitor bridge. The service responds with `allow` immediately, so it never blocks or rejects a customer call.
- Added encrypted Android Keystore-backed configuration and a bounded encrypted offline queue. The server stores only an HMAC phone fingerprint and last four digits.
- Added phone-state event delivery for `answered`, `ended`, and `missed` events. An `ended` event carries the same provider call id and invokes the existing CatchCall notification finalization path.
- Added the one-time Android setup flow: the owner enables PetManager as the call-screening app and grants phone-state access. The five-second platform deadline is handled by the service code, not by the owner.
- Source checks passed: mobile TypeScript typecheck, targeted mobile ESLint, Android Java compilation, and 8 CatchCall contract tests.

This milestone is source-complete only. The Supabase migrations still require an explicitly approved development DB apply/readback, and a physical Android device test is required to verify OEM-specific phone-state delivery. iOS and carrier/provider integrations remain separate adapters; they are not silently treated as complete.

## Database apply status (2026-09-27)

- Applied the caller-ID foundation and CatchCall reservation migrations to the linked development project and the production Supabase project.
- Readback confirmed both `call_integrations` and `call_events`, CatchCall reservation columns, tenant trigger, RLS enabled, and service-role-only table access.
- Supabase advisors report the new tables as RLS-enabled with no public policies; this is intentional because all access goes through the authenticated server/service-role boundary. Existing project-wide advisor findings remain separate.
- Vercel production and preview now contain distinct sensitive values for `CALL_ID_PHONE_HMAC_SECRET` and `CALL_ID_WEBHOOK_HASH_SECRET`.

## Vercel deployment verification (2026-09-27)

- Production deployment `dpl_5oP97maiFWqUakbt7k76ea3kcCLQ` reached `READY` and is aliased to `www.petmanager.co.kr` and `petmanager.co.kr`.
- Production smoke checks reached the deployed CatchCall handlers: owner call-events returns the expected missing-shop validation response, and the webhook rejects an unknown integration without exposing provider details.
- Vercel runtime logs show the same responses from the new deployment with no build/runtime error for these checks.
- Remaining release gate: verify Android `CallScreeningService` and phone-state delivery on a physical OEM device; iOS and carrier/provider adapters remain separate milestones.
