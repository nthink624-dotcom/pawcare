# 예약금 모바일 흐름 검증 결과

대상: 개발 `petmanager-dev / qefxdtmdtvnzgupmjlom`, 가상 매장 `deposit-preview-12b5026a`만. 운영 DB·운영 배포·실제 송금·외부 메시지 발송은 하지 않았다.

## 검증 범위와 결과

| 흐름 | 결과 | 실행 근거 |
| --- | --- | --- |
| 고객 모바일 시작→정보→서비스→날짜/시간→신청 전 예약금·시간·환불 안내→신청 | 통과 | 390px 실제 브라우저 UI로 송예린/토리 새 예약 생성. 대상 예약은 확정이 아닌 입금 대기. |
| 계좌 확인·복사→입금자명→입금했어요→매장 확인 대기 | 통과 | 실제 계좌 복사 동작 성공. 가상 한지우 테스트에서는 Windows 클립보드와 값도 대조. 실제 은행 이체는 안 함. 신고 후 예약 pending/원장 reported, 실확인액·차감액 0원. |
| 비대상 고객의 신규 예약 | 통과 | 한지우/구름의 첫 예약금에 오너가 모의 입금 확인을 기록한 뒤, 다른 날짜 추가 예약을 모바일 UI로 신청해 즉시 confirmed. 고객 예외는 inherit로 복구한 상태이며 추가 입금을 요청하지 않음. |
| 앱 전환을 대신한 탭 복귀·새로고침·뒤로·관리 링크 | 통과(브라우저 모의) | 실제 새 문서 로드와 뒤로 이동 후 같은 예약/계좌/최초 기한 재조회. GET만 반복한 구간의 신고 시각·report 이력 수·금액 불변, 동일 슬롯 예약 1건. |
| 입금자명 수정·긴 이름 | 통과 | 실제 가상 신고 이름 변경 후 최초 기한 불변. 이름을 원래 송예린으로 복구. 같은 이름으로 중복 신고 버튼은 비활성. |
| 긴 계좌/예금주 | 통과(레이아웃 스트레스) | 실제 화면 DOM에 합성 긴 문자열을 잠시 넣고 즉시 복구. DB는 변경하지 않음. 320/390/430/1024/1440px 가로 넘침 없음. |
| 오너 전용 모바일에서 입금 총액 확인 | 통과 | **3100 `/owner/mobile` 실제 앱**, PC 오른쪽 패널 축소가 아님. 공통 예약금 블록을 기존 모바일 상세 Sheet 안에 연결. 20,000원 확인→예약 confirmed/배분 20,000원. |
| 오너 모바일 고객별 필수/면제 | 통과 | always→exempt→inherit를 UI에서 저장하고 실제 개발 API 재조회. 기존 방문 고객 체크도 같은 공통 컴포넌트로 제공. 기존 차단·승인 권한은 변경하지 않음. |
| 오너 모바일 일정 변경 | 통과 | 10:00→11:00 실제 저장, 원래 입금 기한 `2026-10-19T11:59:39.211457+00:00` 유지. 실제 시간 확보/권한 검사는 기존 API 그대로. |
| 오너 모바일 취소·환불 | 통과 | 오너 취소→전액 20,000원 환불 대기→모의 직접 환불 완료 기록. 원장 환불 완료 20,000원/잔액 0원, 이미 확정된 추가 예약은 소급 부과 없이 유지. |
| 키보드에 따른 화면 축소 | 통과(축소 viewport 모의) | 고객/오너 각각 390×440px로 줄여 입력란과 신고·확인 버튼이 함께 보이는지 검사. **실제 iOS/Android 키보드나 IME 검증은 아님.** |
| 실제 휴대폰·실제 은행 앱 전환·네이티브 APK | **미검증** | 연결된 실기기/ADB 검증은 수행하지 않음. 브라우저 모바일 에뮬레이션과 구분. |

## 고객 화면 순서 — 실제 390px 캡처

| 1. 예약 시작 | 2. 날짜·시간 선택 |
| --- | --- |
| ![예약 시작](../../.codex-work/deposit-mobile-flow-20261018/01-customer-start.png) | ![일정 선택](../../.codex-work/deposit-mobile-flow-20261018/02-customer-date-time.png) |

| 3. 신청 전 금액·기한·환불 안내 | 4. 입금 대기 접수 |
| --- | --- |
| ![신청 전 안내](../../.codex-work/deposit-mobile-flow-20261018/03-customer-deposit-before-submit.png) | ![입금 대기 접수](../../.codex-work/deposit-mobile-flow-20261018/04-customer-booking-pending.png) |

| 5. 계좌 복사·입금자명·입금했어요 | 6. 신고 후 매장 확인 대기 |
| --- | --- |
| ![입금 안내와 신고](../../.codex-work/deposit-mobile-flow-20261018/05-customer-bank-report.png) | ![매장 확인 대기](../../.codex-work/deposit-mobile-flow-20261018/07-customer-store-review.png) |

## 오너 전용 모바일 화면

입금 확인 입력 캡처는 고객 흐름과 같은 송예린/토리의 확인 대기 예약이다. 실제 확인→일정 변경→취소·환불 회귀에는 한지우/구름 예약을 사용했다. 서로 다른 예약/상태를 동일 조건 전후 비교로 제시하지 않았다.

| 입금 확인 | 축소 viewport 입력·확인 |
| --- | --- |
| ![모바일 확인](../../.codex-work/deposit-mobile-flow-20261018/08-owner-mobile-confirm.png) | ![입력과 확인 동시 노출](../../.codex-work/deposit-mobile-flow-20261018/08b-owner-mobile-keyboard.png) |

| 일정 변경 | 고객별 필수·면제 |
| --- | --- |
| ![일정 변경](../../.codex-work/deposit-mobile-flow-20261018/10-owner-mobile-schedule.png) | ![고객별 설정](../../.codex-work/deposit-mobile-flow-20261018/11-owner-mobile-customer-preference.png) |

| 모의 환불 완료 입력 | 환불 완료 상태 |
| --- | --- |
| ![직접 환불 기록](../../.codex-work/deposit-mobile-flow-20261018/15b-owner-mobile-refund-action.png) | ![환불 완료](../../.codex-work/deposit-mobile-flow-20261018/16-owner-mobile-refund-done.png) |

비대상 예약의 확정 화면:

![비대상 확정](../../.codex-work/deposit-mobile-flow-20261018/13-non-target-confirmed.png)

## 실제로 보완한 연결

- `apps/shared/components/booking-deposit-ledger-panel.tsx`, `booking-deposit-customer-preference.tsx`: 기존 UI를 한곳으로 이동. 웹은 wrapper, 모바일은 기존 상세 내부에서 재사용. 별도 원장·정산 계산·모바일 예약 시스템을 만들지 않음.
- 고객: 기존 `customer-booking-page.tsx`, `customer-first-visit-claude-flow.tsx`, `customer-booking-manage-panel.tsx`, `booking-preparation-panel.tsx`. 신청 전 판정 미조회 때 면제로 오인시키던 문구, 실제 완료 상태 제목, 계좌 복사/입금했어요, 복귀 재조회, 중복 동일이름 신고 방지, 입력 폼 스크롤 보완.
- 완료 영수증은 유지하면서 관리 주소를 서명 fragment로 남긴다. 관리 버튼은 그 주소를 명시적으로 재조회한다. 같은 fragment를 재할당하는 것만으로 페이지 전환이 생긴다고 가정하지 않는다. 추가 예약의 프로필 조회도 토큰을 query 대신 header에 보낸다.
- `apps/web/src/lib/use-booking-resume-refresh.ts`: focus/visibility/pageshow 시 기존 서버 조회만 실행. 예약 생성/입금 신고 POST를 실행하지 않음.
- `apps/mobile/src/components/owner/owner-booking-deposit-panel.tsx`, 기존 `owner-app.tsx`: 실제 모바일 상세 Sheet, 기존 홈의 대기 예약 진입, 기존 서버 API 연결. 기존 모바일 수정/상태 변경 요청에서 빠져 있던 현재 shopId 2곳 보완.
- `apps/web/src/app/api/owner/booking-preparation/route.ts`, `booking-deposits/route.ts`: 기존 공통 허용 출처 CORS/OPTIONS 사용. 오너·매니저/매장 권한 검사 유지. 임의 출처나 직원에게 권한을 열지 않음.
- 인증된 bootstrap에 서버가 확인한 `actor`를 추가해 위임 오너를 직원으로 오인하던 문제를 수정. 양 앱 DTO/공통 계약·모바일 역할 해석에 반영. 위임 오너의 운영 권한과 대표 오너의 결제 관리 권한을 합치지 않으며, 원래 결제 API의 403은 유지한다. 운영 접근은 기존 서버 구독 검사 그대로다.
- 저장된 아기 목록에서 로컬 초안의 같은 `primary` 표시 ID 때문에 발생한 React key 중복은 표시 키를 ID+이름으로 구분. DB 고객/반려동물 ID나 이름을 바꾸거나 숨기지 않음.

## 테스트 데이터와 보존

이번에 새로 만든 가상 예약은 아래 3개뿐이며, 새 보호자/반려동물은 한지우·구름 및 송예린·토리 2쌍이다. 시나리오명은 제품 이름·예약 제목에 넣지 않았다. ID 전체는 `.codex-work/deposit-mobile-flow-20261018/created-fixtures.json`에 기록했다.

| 예약 ID | 확인 후 상태 |
| --- | --- |
| `e4145395-fbdd-4dcd-a8a1-38146d98666d` | 한지우/구름, 10/20 11시, 취소·모의 환불 완료 |
| `c0fc21f5-3bb9-4ca3-8312-3ab60d625a8b` | 송예린/토리, 10/22 9시, 고객 신고·매장 확인 대기, 실제 확인액 0원 |
| `2aac00cf-21d3-4f2d-b562-5bd200f80929` | 한지우/구름 추가 예약, 10/23 9시, 비대상 즉시 확정 |

테스트 데이터는 확인용으로 보존했다. 삭제/일괄 정리를 하지 않았다. 향후 정리는 위 ID와 manifest의 새 보호자·반려동물 ID에 한정해야 하며 기존 가상 매장 전체나 기존 예약을 삭제하면 안 된다.

## 실행 근거·한계

근거 폴더: `.codex-work/deposit-mobile-flow-20261018/`.

- `mobile-target-checks.json`, `non-target-checks.json`, `customer-checks.json`, `native-owner-checks.json`, `native-refund-checks.json`, `final-browser-checks.json`: 위 실제 브라우저/API 결과.
- `final-safety.json`: 비테스트 보호자·예약·예약 준비 데이터 해시 불변, 환경설정 네 파일 불변, 외부 발송 0건, 매장 전체 OFF 유지, 같은 타깃 슬롯 1건. 기존 가상 예약14개에 신규3개를 더한17개.
- 모바일 집중/기존 관계 검사14개, 웹 CORS/예약금/정책 집중13개, workspace10개·공통 UI parity43개 통과. 웹·모바일 타입 검사 통과. 이 수치로 실기기 검증을 대체하지 않는다.
- 초기 넓은 PNG, availability/저장 완료 이전 검사, CDP 재접속/동일 fragment 재할당 도구 오류는 통과 근거로 사용하지 않았다. 최종390 캡처와 새 문서 로드·서버 readback으로 다시 확인했다. 마지막 관리 전환 보완은 기존 신규 예약을 사용한 주소/문서 재조회로 검증했고 불필요한 새 예약은 추가하지 않았다.
- 오너 축소 캡처에서 최초 단순 좌표 검사가 고정 헤더 가림을 놓친 것을 육안으로 발견했다. 실제 스크롤 영역 기준으로 보완하고 짧은 입력 화면에서는 확인 버튼을 금액 입력란 다음에 배치했다. 다른 입력란을 버튼으로 덮지 않는다. 최종 `keyboard-native-check.json`은 입력란·버튼 전체가 스크롤 영역 안에 있고 중심 hit-test도 각각 해당 컨트롤에 도달함을 확인한다. 최종 08b 캡처만 이 결과의 근거다.
- 실제 송금·알림톡 승인 템플릿 발송·운영 스케줄러·환불 법률 검토·네이티브 앱 빌드/배포는 이번 검증에 포함하지 않았다.
- 테스트용 3100 서버(PID16468/CLI36776/worker43300)와 이번 QA 탭13개는 종료 확인했다. 정리 중 이미 자연 종료된 worker에 대한 일시적 process-not-found 이후 전체 PID·포트 재검사로 남은 프로세스0/3100리스너0을 확인했다. 원래 대표용3000 서버(PID24064)·전용 Chrome(PID11572)·기존 대표 탭은 유지했다.

운영 배포는 하지 않았으며 화면 확인 이후의 별도 승인 범위를 기다린다.
