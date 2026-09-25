# Large File Audit

## Summary
- 500줄 이상 파일 개수: 12
- 800줄 이상 파일 개수: 7
- 가장 위험해 보이는 파일 Top 5:
  - `src/components/owner/owner-app.tsx`
  - `src/components/owner/owner-settings-panel.tsx`
  - `src/components/admin/owner-admin-screen.tsx`
  - `src/components/customer/customer-booking-page.tsx`
  - `src/components/owner/owner-billing-screen.tsx`
- UI 작업 전 주의가 필요한 영역:
  - 오너 앱 메인 컨테이너
  - 오너 설정 화면
  - 관리자 오너 계정 관리 화면
  - 소비자 예약 흐름
  - 결제/플랜 화면
  - 서버 billing / mutation / admin route / notification dispatch 영역

## Files Over 500 Lines

- File path: `src/components/owner/owner-app.tsx`
- Approx line count: 2381
- Current role: 오너 앱 메인 화면, 홈/예약/고객/설정 진입, 각종 시트와 카드, 상태 제어가 섞인 대형 UI 컨테이너
- Why risky: 목록, 상세, 액션 카드, 바텀시트, 상태관리, 이벤트 핸들러가 한 파일에 과도하게 섞여 있어 작은 UI 수정도 동작 영향 가능성이 큼
- Suggested split candidates: page shell, summary cards, reservation board, customer blocks, quick-action panel, modal/bottom sheet, empty state, presentational cards
- Functional risk: High
- Safe to split now: No
- Recommended next action: 먼저 화면 블록 단위 책임을 분석하고, presentational component부터 분리 후보를 정의한다

- File path: `pawcare-v3.jsx`
- Approx line count: 1299
- Current role: 제품 UX/IA 기준이 되는 로컬 프로토타입
- Why risky: 파일은 크지만 실제 운영 로직보다 참조용 markup 비중이 높고, 현재 제품 구조의 레퍼런스 역할을 한다
- Suggested split candidates: 없음 또는 향후 섹션별 참조 문서 분리
- Functional risk: Low
- Safe to split now: No
- Recommended next action: 운영 코드가 아니라 참조 자산으로 유지하고, 실제 분리 대상에서 우선 제외한다

- File path: `src/server/owner-billing.ts`
- Approx line count: 1249
- Current role: 오너 구독, 결제, 상태 계산, 환불/복구와 관련된 서버 billing 로직
- Why risky: 결제 상태 계산, 플랜 상태, 환불/실패 처리 같은 핵심 기능 로직이 몰려 있어 UI 작업 중 건드리면 위험함
- Suggested split candidates: billing status calculator, payment reconciliation helper, subscription read model helper
- Functional risk: High
- Safe to split now: No
- Recommended next action: UI 통일 작업 범위에서 제외하고, 별도 리팩토링 계획으로만 다룬다

- File path: `src/components/owner/owner-settings-panel.tsx`
- Approx line count: 1140
- Current role: 매장 기본 정보, 운영시간, 서비스, 계정/플랜 관련 설정을 처리하는 오너 설정 대형 컴포넌트
- Why risky: 폼, 섹션, 저장 로직 연결, 바텀시트 성격 UI가 한 파일에 같이 있어 UI 수정 시 행동 변화 위험이 큼
- Suggested split candidates: page shell section, basic-info form, business hours section, service management section, account section, presentational rows/cards
- Functional risk: High
- Safe to split now: Yes
- Recommended next action: API/저장 로직은 유지한 채 섹션별 presentational block부터 추출 후보를 정의한다

- File path: `src/server/owner-mutations.ts`
- Approx line count: 937
- Current role: 예약/고객/운영 상태 변경 등 오너 서버 mutation 모음
- Why risky: 예약 상태, 고객 데이터, 서비스 동작이 직접 연결되는 핵심 mutation 로직이라 UI 정리와 함께 만지면 위험함
- Suggested split candidates: reservation mutations, customer mutations, settings mutations
- Functional risk: High
- Safe to split now: No
- Recommended next action: UI 통일 작업에서는 제외하고, 기능 경계 분석 후 별도 서버 리팩토링 계획으로 다룬다

- File path: `src/components/admin/owner-admin-screen.tsx`
- Approx line count: 826
- Current role: 관리자용 오너 계정 목록, 상세 패널, 결제/플랜 상태 확인 및 조작 UI
- Why risky: 검색, 목록, 상세, 결제 이력, 상태 변경 UI가 한 파일에 같이 있어 화면 구조 정리 시 기능 영향 가능성이 높음
- Suggested split candidates: toolbar/search bar, owner list, owner row, detail panel, billing history card, status badge/pill, action footer
- Functional risk: High
- Safe to split now: Yes
- Recommended next action: 목록/상세의 presentational layer부터 나누고, 관리자 저장 로직은 기존 위치에 유지한다

- File path: `src/components/customer/customer-booking-page.tsx`
- Approx line count: 818
- Current role: 소비자 예약 메인 흐름, 단계형 입력/선택/시간 선택 UI
- Why risky: 단계 흐름, 입력, 선택, 상태와 렌더링이 강하게 섞여 있어 분리 시 예약 동작에 영향 줄 수 있음
- Suggested split candidates: step shell, service step, date/time step, customer-info step, summary block, bottom CTA
- Functional risk: High
- Safe to split now: No
- Recommended next action: 먼저 단계별 책임을 문서화하고, 순수 시각 블록만 안전하게 추출 가능한지 확인한다

- File path: `src/app/api/admin/owners/route.ts`
- Approx line count: 790
- Current role: 관리자 오너 계정 조회/수정/결제 관련 API 라우트
- Why risky: 구독 상태, 관리자 저장, 결제 상태 반영이 한 라우트에 몰려 있어 UI 변경과 함께 다루면 위험함
- Suggested split candidates: query builder helper, status resolver helper, response mapper helper
- Functional risk: High
- Safe to split now: No
- Recommended next action: UI 통일 작업 범위에서 제외하고, 서버 helper 분리 계획이 필요할 때만 접근한다

- File path: `src/components/owner/owner-billing-screen.tsx`
- Approx line count: 740
- Current role: 플랜 비교, 플랜 선택, 결제 확인, 결제 유도 상태를 보여주는 결제/플랜 UI
- Why risky: 비교, 선택, 확인, 결제 버튼 상태가 한 파일에 얽혀 있어 정리 시 흐름 깨질 가능성이 있음
- Suggested split candidates: page shell, current-plan summary, plan list/selector, selected-plan confirmation, payment method card, empty/expired state blocks
- Functional risk: Medium
- Safe to split now: Yes
- Recommended next action: presentational card와 상태별 안내 블록부터 분리 후보를 정의하고 결제 진입 핸들러는 그대로 둔다

- File path: `src/components/auth/signup-form.tsx`
- Approx line count: 718
- Current role: 일반 회원가입 전체 흐름과 약관, 본인확인, 계정/매장 정보 입력 UI
- Why risky: 단계형 UI, validation, 이벤트 핸들러가 같이 들어 있어 작은 수정도 가입 흐름 영향 가능성이 있음
- Suggested split candidates: terms block, identity block, account block, shop info block, submit footer, status/pager UI
- Functional risk: Medium
- Safe to split now: Yes
- Recommended next action: 단계 UI를 시각 블록으로 먼저 나누고 validation과 submit은 기존 위치에 유지한다

- File path: `backend/src/server/repositories/app-repository.ts`
- Approx line count: 711
- Current role: 백엔드 데이터 접근 레이어
- Why risky: 저장소 계층 자체가 길고 책임이 넓지만 UI 통일 작업과는 직접 관련이 없고, 잘못 건드리면 데이터 흐름에 영향이 큼
- Suggested split candidates: domain-specific repository modules
- Functional risk: High
- Safe to split now: No
- Recommended next action: UI 작업 범위에서 제외하고, 백엔드 리팩토링 별도 이슈로 관리한다

- File path: `backend/src/server.ts`
- Approx line count: 665
- Current role: 백엔드 서버 부트스트랩, 라우트 연결, 초기화
- Why risky: 서버 시작/초기화 경로가 모여 있는 파일이라 기능과 직접 연관된 위험도가 있음
- Suggested split candidates: route registration helper, startup/bootstrap helper, environment/config module
- Functional risk: Medium
- Safe to split now: No
- Recommended next action: 현재 작업에서는 건드리지 않고, 서버 정리 이슈로 별도 분리 계획을 세운다

## Top 5 Refactor Candidates

- File path: `src/components/owner/owner-app.tsx`
- Why this should be prioritized: 오너 앱 핵심 화면 대부분이 몰려 있어 UI 통일 작업의 영향 범위가 가장 넓다
- What can be safely extracted first: summary/stat cards, section headers, empty states, quick-action card, pure list item/card blocks
- What must not be touched: API 호출, 예약 승인/변경 로직, 고객 상태 변경, 알림/결제 연계 로직
- Recommended first safe step: 홈/예약/고객 각 화면의 반복 시각 블록을 presentational component로만 분리 후보 정의

- File path: `src/components/owner/owner-settings-panel.tsx`
- Why this should be prioritized: 설정 화면은 섹션이 명확해 시각 블록 분리 이득이 크고, 현재 크기도 매우 크다
- What can be safely extracted first: 섹션 카드, 입력 row, 대표 이미지 UI, 운영시간 row, 서비스 list item
- What must not be touched: 저장 API 연결, validation, shop/customer page settings 모델
- Recommended first safe step: 기본 정보 섹션과 운영시간 섹션의 시각 블록만 분리 계획 수립

- File path: `src/components/admin/owner-admin-screen.tsx`
- Why this should be prioritized: 관리자 목록/상세 패널 구조가 이미 역할별로 보이므로 시각 블록 분리 효과가 크다
- What can be safely extracted first: search toolbar, owner list row, detail summary cards, billing history card, status badge
- What must not be touched: 관리자 저장, 구독 상태 변경, 환불/결제 처리, 정지/복구 동작
- Recommended first safe step: 좌측 목록 row와 우측 상세 정보 카드를 presentational component로만 분리 계획 수립

- File path: `src/components/customer/customer-booking-page.tsx`
- Why this should be prioritized: 예약 플로우는 사용자 노출 면적이 크고 단계형 구조라, 장기적으로 단계 분리가 필요하다
- What can be safely extracted first: step header, step body wrappers, service option card, datetime option card, summary card
- What must not be touched: 예약 가능 시간 계산, validation, 예약 제출 흐름, 라우팅
- Recommended first safe step: 각 단계의 반복 선택 카드와 요약 카드만 순수 UI 블록으로 분리 후보 정의

- File path: `src/components/owner/owner-billing-screen.tsx`
- Why this should be prioritized: 플랜 비교/선택/확인 상태가 한 파일에 섞여 있어 이후 결제 화면 정돈이 어려워질 수 있다
- What can be safely extracted first: current plan summary, plan comparison card, selected plan confirmation card, CTA block
- What must not be touched: 결제 진입 로직, PortOne 연동 흐름, billing 상태 계산
- Recommended first safe step: 상태별 안내 카드와 플랜 카드만 presentational component로 정리 계획 수립

## Deferred / Dangerous Areas

- `src/server/owner-billing.ts`
  - 결제, 구독 상태, 환불/복구 같은 핵심 billing 로직이 모여 있어 UI 작업 중 같이 건드리면 매우 위험함

- `src/server/owner-mutations.ts`
  - 예약 상태 변경, 고객 관리, 서비스 운영과 직접 연결된 서버 mutation 모음이라 대형 파일이어도 별도 계획 없이는 손대면 안 됨

- `src/app/api/admin/owners/route.ts`
  - 관리자 저장/구독 반영/결제 상태 계산이 들어 있는 API 라우트라 화면 분리와 동시에 다루면 문제를 만들 가능성이 큼

- `src/server/notification-dispatch.ts`
  - 알림톡/알림 발송 분기와 상태 기록이 들어 있어 UI 작업 범위에서 제외해야 함

- `backend/src/server/repositories/app-repository.ts`
  - 데이터 접근 계층 전체가 길어서 구조상 리팩토링 후보이지만, UI 분리 기준으로는 지금 접근 대상이 아님

- `backend/src/server.ts`
  - 서버 부트스트랩과 초기화 경로라, 기능과 무관한 UI 작업과 섞어서 만지면 위험함

- `src/components/auth/signup-form.tsx`
  - presentational extraction은 가능하지만 가입 validation/auth 흐름이 같이 있어 무리하게 분리하면 가입 동작에 영향이 갈 수 있음
