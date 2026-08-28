# AI_PRICE_GUIDE_MOBILE_EDITABILITY_AND_DEV_BLOCKER_PLAN v0.1

작성일: 2026-08-27  
표준 업무명: `회원가입 중 서비스·가격 최초 등록`  
검토 범위: PC 웹의 실제 `/signup` 모바일 반응형 화면, 공유 가입 API·Supabase 계약  
실행 제한: Development migration 적용 0, 외부 Vision 호출 0, Production 접근·변경 0, 실제 고객 이미지·실제 매장 데이터 사용 0

## 1. 결론

- 모바일 반응형 가입 화면은 **구조화 Draft의 행 추가·수정·복수 행 삭제, 판독 실패 시 직접 입력, 최종 가입 요청의 원자 저장**까지 연결되어 있다.
- main `/signup`과 preview API는 `AI가 읽은 임시 목록`, `틀린 내용을 고친 뒤 저장하세요. 저장 전에는 공개되지 않습니다.`, `검토 완료하고 저장` 공유 문구 계약을 사용한다. 마지막 한 행 삭제와 행별 판독 신뢰도/확인 필요 표시는 F 구현 결과와 합쳐 검증해야 하므로 전체 모바일 편집 계약은 아직 **부분 충족**이다.
- Development E2E는 아직 실행 준비가 끝나지 않았다. `owner_shop_memberships` schema drift, Vision/meter secret 부재, 요청당 비용 예약액 과소계상이 남아 있다.
- UI팀의 `MOBILE_AI_PRICE_GUIDE_REVIEW_FLOW v0.1.1`은 운영 적합 판정을 받았고 F(`D:\petmanager-app`)가 앱 전용 구현을 진행 중이다. main은 backend/AI를 복제하지 않도록 preview API의 단일 Draft·validation·save 계약만 제공한다.

## 2. 확정 모바일 제품 계약

1. 원본 사진은 immutable·ephemeral이다. 분석·재촬영·취소·확정·만료 뒤 폐기하고 DB·Storage·로그에 영구 저장하지 않는다.
2. AI provider raw output은 요청 메모리 안에서 엄격한 schema로 파싱한 뒤 폐기한다. 원문은 DB·Storage·로그·사용자 응답에 저장하지 않는다.
3. 구조화 Draft는 모바일에서 서비스명·상세 항목·가격·소요시간·동물·품종 그룹·체중 구간을 수정할 수 있고 행을 추가·삭제할 수 있다.
4. 판독 직후 자동 활성화·자동 공개하지 않는다. 사용자가 명시적으로 `검토 완료하고 저장`한 구조화 값만 최종 가입 요청에 포함한다.
5. 최종 가입 성공 시 계정·매장·서비스·가격을 같은 가입 operation으로 원자 저장한다.
6. 저장된 서비스·가격은 가입 뒤 서비스 관리에서 다시 수정할 수 있다.
7. AI 실패·부분 판독·0건이면 같은 화면에서 직접 입력으로 전환하고, 이미 입력한 행과 브라우저의 사진 미리보기를 잃지 않는다.

## 3. 현행 모바일 Gap Matrix

| 계약 | 상태 | 화면·코드 근거 | Gap / 후속 |
|---|---|---|---|
| 원본 immutable·ephemeral | 충족 | 브라우저 `URL.createObjectURL` 미리보기와 revoke: `signup-service-pricing-step.tsx:126-129`; 서버 buffer는 request scope에서만 사용하고 `store: false`: `price-guide-photo-import.ts:253` | 성공·실패·timeout buffer zeroing 테스트는 기존 P0 테스트를 유지한다. |
| AI raw output 영구 저장 금지 | 충족 | provider payload는 요청 메모리에서 JSON schema parse 후 정규화만 반환: `price-guide-photo-import.ts:286-294`; DB cache에는 정규화된 PreviewPayload만 암호화·TTL 저장 | provider payload/오류 body를 로그에 추가하지 않는 회귀 테스트를 유지한다. |
| 서비스명·가격 추가/수정 | 충족 | 모든 필드가 controlled Draft state이며 행 추가 제공: `signup-service-pricing-step.tsx:81-87, 260-270` | UI팀 시안 수신 시 모바일 숫자 키보드·행 접기 구조만 조정한다. |
| Draft 행 삭제 | 부분 충족 | 복수 행일 때 삭제 가능: `signup-service-pricing-step.tsx:257` | 마지막 한 행은 삭제할 수 없다. 0건 상태로 되돌리거나 빈 직접 입력 행을 유지할지 UI팀 결과에 맞춰 확정한다. 저장은 최소 1행 검증을 유지한다. |
| 명시적 검토 뒤에만 저장 | 충족 | 수정 때 `confirmed=false`, `검토 완료하고 저장` 뒤에만 다음 단계 활성화: `signup-service-pricing-step.tsx:81-84, 184-188, 276`; 최종 영구 저장은 `/api/auth/signup` 한 요청 | 첫 CTA는 브라우저 임시 목록 확인 완료이며, 서버 canonical 저장은 최종 가입 때만 발생한다는 설명을 유지한다. |
| 자동 활성화·자동 공개 금지 | 충족 | AI 성공은 Draft state만 바꾸고 서버 서비스 행을 만들지 않는다: `signup-service-pricing-step.tsx:168`; 최종 가입 RPC에서만 저장: `signup/route.ts:302` | 저장된 서비스는 현재 `is_active=true`로 생성된다. 이는 사용자가 최종 가입까지 명시적으로 완료한 뒤이므로 계약에 부합한다. |
| AI 실패·0건 직접 입력 | 충족 | 503/422/0행에서 직접 입력 상태와 빈 행을 제공: `signup-service-pricing-step.tsx:158-175`, preview API `169-170` | 부분 판독 행별 `확인 필요` 표시가 모바일 편집 폼에 없다. |
| 입력 손실 방지 | 충족 | 실패 시 기존 `services`가 있으면 덮어쓰지 않고, 사진 object URL을 유지한다: `signup-service-pricing-step.tsx:165, 174` | 페이지 새로고침까지 복구하는 persistence는 의도적으로 없다. 개인정보 입력 전 영구 저장 0 원칙을 우선한다. |
| 저장 후 다시 수정 | 충족 | 서비스 관리에서 상세 요금 변경·즉시 저장 경로 제공: `service-management-screen.tsx:695-705, 892-899` | 모바일 앱 전용 화면 구현은 `D:\petmanager-app` UI팀 소유다. 이 저장소에서는 공용 API·데이터 계약만 유지한다. |
| 행별 불확실성 확인 | 미구현 | API의 `issues`는 PreviewPayload에 있으나 가입 편집 컴포넌트는 `services`만 소비한다 | UI팀 결과에 행별 확인 필요 배지·필터·확인 완료 조건을 통합한다. |
| 인식/유효/확인 필요 count | 미구현 | 화면에는 현재 Draft 행 개수와 오류 행 집계가 없다 | v0.1.1의 count 정의를 API `issues`와 client validation에 연결한다. |
| Validation CTA | 부분 충족 | `valid`가 false면 버튼만 disabled되고 막힌 필드·건수를 한곳에서 설명하지 않는다: `signup-service-pricing-step.tsx:178-181, 276` | CTA 주변에 저장 불가 이유와 첫 오류 이동을 제공한다. |
| 가격 formatting·native 숫자 키보드 | 부분 충족 | `inputMode="numeric"`는 있으나 편집 중 원화 formatting은 없다: `signup-service-pricing-step.tsx:263-264` | 표시값 formatting과 숫자 원본 state를 분리하고 모바일 native keyboard 회귀를 검증한다. |
| 삭제·recovery 안전성 | 부분 충족 | 복수 행 삭제는 즉시 반영되며 undo가 없다. 실패 시 기존 Draft 보존은 구현돼 있다 | v0.1.1 적합 전 삭제 구현을 확정하지 않고 undo/복구 계약을 먼저 고정한다. |

화면 근거: `D:\petmanager\tmp\signup-flow-development-mobile.png`. 이 캡처는 현재 모바일 반응형 세로 구조와 직접 입력 fallback을 보여준다. 최종 UI팀 결과 수신 뒤 동일 viewport로 다시 캡처해야 한다.

## 4. Blocker A — `owner_shop_memberships` schema drift

### 읽기 전용 확인 결과

- 대상: Development `petmanager-dev` (`qefxdtmdtvnzgupmjlom`).
- `supabase_migrations.schema_migrations`에는 `202605190005_multi_shop_foundation`이 적용 완료로 기록돼 있다.
- 현재 `public.owner_shop_memberships`는 없으며 유사 이름 relation도 0개다.
- canonical local migration `202605190005_multi_shop_foundation.sql`은 해당 테이블·PK·role check·primary-owner unique index·shop index와 backfill을 생성한다.
- 이후 로컬 migration 전체에서 이 테이블을 drop하는 구문은 발견되지 않았다.
- 첫 pending `20260826034028_secure_owner_shop_memberships.sql`은 `ALTER TABLE IF EXISTS` 뒤 존재를 전제로 `REVOKE`하므로 현재 Development에는 그대로 적용할 수 없다.

### 원인 판정

현재 catalog만으로 행위자·시점은 증명할 수 없다. 가장 가능성 높은 원인은 **migration ledger를 유지한 상태에서 수행된 out-of-band DROP, 부분 schema restore 또는 clone/reset 불일치**다. 정상적인 local migration chain의 결과로 보기는 어렵다. DDL 감사 로그가 없으므로 이를 확정 원인으로 보고하지 않는다.

### 대표 승인 없이 준비할 복구 패킷

1. 적용 전 read-only assertion
   - migration ledger에는 `202605190005`가 1건이어야 한다.
   - membership table은 없어야 한다.
   - `shops.owner_user_id`와 `owner_profiles.shop_id`의 FK 대상·타입을 canonical migration과 비교한다.
   - backfill 후보에서 한 owner가 둘 이상의 primary shop을 갖게 되는 데이터가 없는지 aggregate로 검사한다.
2. pending `20260826034028`을 Development 미적용 상태에서 **reconciliation migration**으로 보강하는 안을 우선 검토한다.
   - 기존 canonical DDL을 그대로 재사용한다.
   - table, PK/check, 두 index를 만든 뒤 canonical backfill을 수행한다.
   - RLS enable, `PUBLIC/anon/authenticated` revoke, `service_role` 서버 전용 권한을 명시한다.
   - 모든 assertion과 DDL을 한 transaction에 넣고 하나라도 실패하면 전체 rollback한다.
3. 후속 pending 4개를 다시 `db push --dry-run`하여 exact order와 대상 ref를 재확인한다.
4. 실제 Development apply는 별도 승인 패킷에서만 수행한다.

### Rollback 계약

- recovery가 새로 만든 table이라는 precondition과 후속 membership write 0을 확인한 경우에만 transaction 안에서 index·table을 역순 제거한다.
- 가입 테스트나 후속 write가 1건이라도 생기면 destructive DROP rollback을 금지한다. 이때는 snapshot 복구 또는 forward-fix만 허용한다.
- migration ledger를 수동 repair/delete/rename하지 않는다.
- rollback 뒤 `to_regclass`, grants, policies, pending migration list를 다시 검증한다.

## 5. Blocker B — Vision secret

- Development의 `OPENAI_API_KEY`와 `SIGNUP_PRICE_GUIDE_METERING_SECRET`은 값 노출 없이 확인했으며 현재 **부재**다.
- secret 연결 전 fixture mode만 허용하고 실제 AI 성공으로 표시하지 않는다.
- secret 연결과 외부 호출은 이 패킷 범위에서 실행하지 않는다.

## 6. Blocker C — 비용 meter 교정안

### 현재 문제

- route 예약·완료 금액: `1,200 microUSD` (`$0.0012`), `price-guide-preview/route.ts:29, 146, 182`.
- 현재 모델·high-detail·최대 출력 제한을 기준으로 한 보수적 요청당 상한: 약 `13,000 microUSD` (`$0.013`).
- 현재 일일 cap 기본값은 `500,000 microUSD` (`$0.50`)다.
- 따라서 최악 요청은 meter에 실제보다 약 10.8배 작게 잡혀 일일 비용 차단을 늦출 수 있다.

### 교정 제안

1. `MAX_REQUEST_COST_MICRO_USD = 13_000`을 예약액으로 사용한다.
2. provider 응답에서 `usage.input_tokens`, `usage.output_tokens`만 즉시 추출한다. raw response와 텍스트는 저장하지 않는다.
3. `gpt-4o-mini` 기준 `ceil(input_tokens × 0.15 + output_tokens × 0.60)`을 microUSD 실제값으로 계산한다.
4. usage가 없으면 실제값을 `13_000`으로 기록해 fail closed한다.
5. 실제값이 예약액을 초과하면 초과액도 원장에 반영하고 circuit breaker 경고를 남긴다. 다음 요청은 새 상한 검토 전 차단한다.
6. cache hit는 provider 비용 0으로 유지하되 IP/session/device 요청 횟수 제한은 계속 증가시킨다.
7. 현재 `$0.50/day` cap을 유지하면 최대 비용 기준 약 38회에서 차단된다. cap 변경은 이 작업에 포함하지 않는다.

### fixture 테스트 계약

- 예약 13,000 → 성공 actual 정산 후 reserved 0.
- usage 없음 → actual 13,000.
- 실패/timeout → 보수적으로 reserved 13,000을 실제 비용 원장으로 이동하고 circuit count 증가.
- 분석 시작 전 취소·manual·retake → provider 호출 전이면 reserved 해제, 호출 후 상태라면 usage/보수 상한으로 정산.
- 동일 hash cache hit → provider actual 0, 요청 횟수는 증가.
- purge→새 token 20회에도 6/8/10회와 일일 cap 유지.
- raw provider payload·원본·재인코딩 buffer·file/binding hash는 영구 저장 0.

## 7. UI v0.1.1 적합 후 통합 순서

적용 gate는 통과했다. F는 다음 v0.1.1 요구를 앱 전용 shell에 구현하고, main은 API·validation·원자 저장 계약만 제공한다.

- 인식·유효·확인 필요·전체 행 count를 사용자가 혼동하지 않게 구분한다.
- Validation CTA는 저장 가능한 상태와 막힌 이유를 같은 위치에서 설명한다.
- manual mode에서도 사진과 기존 Draft를 잃지 않고 모드를 왕복할 수 있게 한다.
- 가격 표시와 입력을 분리해 화면에는 원화 formatting, 입력에는 native numeric keyboard를 제공한다.
- 삭제·실수 복구·재촬영·판독 실패에서 마지막 유효 Draft를 보존한다.

1. `MOBILE_AI_PRICE_GUIDE_REVIEW_FLOW`의 화면 상태명·버튼 위치·행 접기/펼치기를 현재 Draft state machine에 매핑한다.
2. 행별 `확인 필요`와 수정 완료 상태를 추가하되 provider raw output은 전달하지 않는다.
3. `판독됨 → 수정 중 → 검토 완료 → 가입 정보 → 최종 가입 저장` 상태를 명시하고, 어느 버튼도 판독 직후 자동 저장하지 않게 한다.
4. 취소·재촬영·manual·pagehide의 purge와 입력 보존 동작을 UI 상태 전환 테스트에 연결한다.
5. PC `/signup` 모바일 viewport와 `D:\petmanager-app`의 앱 전용 화면은 같은 API payload·validation을 사용하되 UI 구현 파일은 각 프로젝트 경계를 지킨다.

## 8. 통합 테스트 계약

- 모바일: 촬영/선택 → fixture 판독 → 행 수정 → 추가 → 삭제 → 검토 완료 → 가입 정보 → 최종 확인.
- 실패: Vision 503, provider timeout, 부분 판독, 0행, schema invalid, purge 실패에서 직접 입력과 기존 값 보존.
- 저장: 검토 전 network 영구 저장 0, 최종 가입 요청 1회, 서비스·가격 고아 0, 409 idempotency/payload mismatch.
- 재진입: 가입 성공 뒤 서비스 관리에서 저장된 서비스·가격 조회·수정.
- 접근성: 행 삭제 accessible name, 숫자 input mode, 키보드가 열린 상태의 하단 버튼 접근, 오류 focus 이동.
- 보안/비용: 8MB/40MP/decoder 제한, raw/PII 로그 0, 13,000 microUSD 예약·정산, rate/cap/circuit 회귀.

## 9. 대표 승인 대기 상태

현재는 **준비 중**이다. schema reconciliation·rollback 초안과 비용 meter 코드/fixture 테스트가 검수 가능한 상태가 된 뒤, 대표 승인 대기에는 다음 한 건만 올린다.

> Development 비식별 fixture Vision 1회 호출 및 최대 약 `$0.013` 비용 승인

실제 migration 적용, Development secret 연결, 외부 Vision 호출은 그 승인 전까지 금지한다.

## 10. 이번 검증 결과

- 비식별 fixture: `D:\petmanager\artifacts\secure-ai-price-guide-import-v0.1\korean-price-guide-fixture.png`
- 크기: 47,689 bytes
- SHA-256: `9f47a16ca1f09dcbdab3da5fcfb30e9657c6944cfd228917b8f75b53c8d90af4`
- 보안·계약 회귀 테스트: 23/23 통과
  - decoder·MIME 위장·truncated·polyglot·oversize
  - 일회성 token·purge·20회 우회 공격·비식별 meter
  - cache 암호화·multipart pre-parse 제한·timeout
  - KCP/Credit/서비스 원자 저장 계약·rollback 계약
- 주의: `13,000 microUSD` 교정은 이 문서의 **교정안**이며 아직 코드·migration에 반영하지 않았다. 따라서 테스트 통과를 비용 교정 구현 완료로 해석하면 안 된다.
