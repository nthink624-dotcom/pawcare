# 예약금 잔여 세 항목 완료 — 개발 전용

대상: `petmanager-dev / qefxdtmdtvnzgupmjlom`, 정본 `D:\petmanager`.
이번 작업은 아래 세 항목에 한정했다. 새 예약금 정책·설정·메뉴·테이블·컬럼·운영 작업을 추가하지 않았다.

## 항목별 실제 결과

| 항목 | 결과 | 직접 확인한 내용 |
| --- | --- | --- |
| 입금액 정정 / 입금 확인 취소 | 통과 | 실제 오너 UI로 30,000→10,000→20,000원 정정. 동일 날짜 배분 합계가 실제 총액을 넘지 않음. 별도 확인 취소로 두 예약 모두 대기, 확인·차감·환불 가능액 0원. 고객 신고·최초 기한·감사 기록 보존. 실제 오너 UI 재확인으로 원래 20,000원 확정 상태 복귀. |
| 정책 화면 문자열 검사 | 통과 | 기존 테스트만 폐기된 고객 선택형 `optional`을 기대하고 있었음. 이미 승인된 제품의 `required` ON 계약으로 기대값 1곳 수정. 제품의 대상 선정·정책·선택값은 변경하지 않음. 해당 파일 4/4 통과, 검사를 삭제하거나 건너뛰지 않음. |
| 하단 이동 버튼 | 통과 | 실제 1440·1024·430·390px에서 화면 내 44px 버튼, 클릭 시 확인 동작으로 이동·포커스, 키보드로 버튼에 접근 후 Enter 이동·포커스 확인. 기존 크기 계약과 focus-visible 표시만 보완. |

### 입금 정정의 안전 경계

- 금액 정정과 `revoke_deposit`는 별도 동작이다. 확인 취소는 실제 환불도, 고객의 허위 신고 판정도 아니다.
- 확인 취소에는 오너의 사유가 필요하다. `revoke` 및 기존 자동 배분 변경 감사가 남고, 기존 신고자명·시각·신고 유효성은 삭제하지 않는다.
- 취소에서 알림 outbox dispatcher를 호출하지 않는다. 실제 브라우저 검사 전후 알림·outbox 각각 3건으로 불변, 외부 발송 0건.
- 정정 직후 자동 만료·시작 자동 확정을 보류한다. 오너의 명시적 재확인/기존 재요청 등으로 재개한다. 고객의 입금자명 수정만으로 보류가 풀리지 않는다.
- 실제 개발 타이머가 실행되는 동안 취소 상태가 유지됨을 확인했다. 원격 SQL의 미래 시각 판정 및 두 세션의 취소/시간작업 경합도 검증했다. 두 경합 트랜잭션은 모두 원복했다.
- 이미 사용·환불·수수료 정산·날짜 승계가 발생한 경우 확인 취소는 409 수동 정산 안내로 막는다. 완료된 금전 기록을 자동으로 되감는 정책은 만들지 않았다.
- 사용·환불 완료 가상 J 예약의 API 거부 및 기존 기록 보존 확인. 원격 트랜잭션 검사에서 총액 32,000원 정정 시 사용 25,000원·환불 완료 5,000원·추가 환불 가능 2,000원 계산 확인 후 원복했다.

## 동일 조건의 실제 전후 화면

모든 비교는 A1 `732cbfee-14a1-46d5-be49-008ba27747b1`, 김민지/보리, 예약 확정·실입금 확인 20,000원, 동일 최초 기한이다. 이름 치환은 하지 않았다. PC는 1440×1000, 모바일은 390×1000이다. 스크롤바를 제외한 CSS 내용 폭과 PNG 외곽 폭은 다르다.

| 화면 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 오너 PC | ![오너 PC 전](../../.codex-work/deposit-final-three-20261018/before-owner-pc.png) | ![오너 PC 후](../../.codex-work/deposit-final-three-20261018/after-owner-pc.png) |
| 오너 모바일 | ![오너 모바일 전](../../.codex-work/deposit-final-three-20261018/before-owner-mobile.png) | ![오너 모바일 후](../../.codex-work/deposit-final-three-20261018/after-owner-mobile.png) |
| 고객 모바일 | ![고객 모바일 전](../../.codex-work/deposit-final-three-20261018/before-customer-mobile.png) | ![고객 모바일 후](../../.codex-work/deposit-final-three-20261018/after-customer-mobile.png) |

오너 화면에서는 별도 ‘입금 확인 취소’, 효과 설명, ‘정정·확인 취소 사유’가 추가됐다. 고객의 정상 확정 화면은 의도적으로 변경하지 않았다. 확인 취소 상태에서만 추가 송금 금지·매장 확인 대기 안내가 나타난다. 아래는 같은 예약이지만 **취소 후 다른 상태**이므로 위 확정 상태와 전후 레이아웃 비교로 사용하지 않는다.

| 확인 취소 후 오너 — 실제 키보드 포커스 | 확인 취소 후 고객 |
| --- | --- |
| ![오너 보류와 하단 이동](../../.codex-work/deposit-final-three-20261018/held-owner-mobile.png) | ![고객 추가 송금 금지](../../.codex-work/deposit-final-three-20261018/held-customer-mobile.png) |

## 변경 파일과 개발 적용

- `apps/web/src/components/booking/booking-deposit-ledger-panel.tsx`: 정정/취소 분리, 사유·수동 예외·고객 보류 안내, 포커스.
- `apps/web/src/components/booking/booking-preparation-panel.tsx`: 확인 취소 성공 안내.
- `apps/web/src/components/owner-web/calendar-management-screen.tsx`: 하단 기존 버튼 크기 계약·포커스.
- `apps/web/src/server/booking-deposit-ledger.ts`, `booking-preparation.ts`: 오너 action 및 알림 건너뛰기, 기존 비원장 경로 안전 거부.
- `apps/shared/contracts/booking-deposit-ledger.ts`, `docs/shared/data-contracts.md`: 하위 호환 `confirmationReviewRequired` 계약.
- `apps/web/tests/server/booking-policy-deposit-layout-contract.test.mjs`: 오래된 기대값 수정.
- `apps/web/tests/server/booking-deposit-confirmation-revoke.test.mjs`: 구분·권한·발송·수동 예외 집중 회귀.
- `supabase/migrations/20261018110924_booking_deposit_confirmation_revoke_fix.sql`: 서비스 전용 보류 판정 helper 및 기존 act/tick/view 세 함수만 수정.

실제 적용: 2026-10-18 20:14:34 KST (11:14:34.357Z), 지정 개발 프로젝트만.
SQL SHA-256: `1d4c440cf9d2ffff13d545c743847cc19fd7084fc5158d8f1dc74a9373566dfc`.
기존 마이그레이션 이력 repair·덮어쓰기 없이 새 행만 기록했다.

개발 백업/동일 PC 격리 복원 검증은 적용 전 20:10:21 KST 완료했다. 함수 원본·ACL과 `rollback.sql`도 보존했다. held 계정이 남은 경우 원복 스크립트는 중단해 데이터 이력과 기능을 분리해 잃지 않도록 한다. Hosted 전체 복원·다른 PC 복원은 여전히 미검증이다.

## 검증 근거와 데이터 범위

근거 위치: `.codex-work/deposit-final-three-20261018/`.

- `application.json`, `regression.sql`: 실제 개발 DB 적용 전/후 트랜잭션 회귀 통과·테스트 변경 원복.
- `race.json`: 실제 개발 DB 두 연결의 경합 통과, 모두 원복·원래 원장 JSON 불변.
- `after-browser.json`: 실제 앱/API·브라우저 30항목 통과, 실패 0. 단순 단위 테스트로 위 세 항목을 대체하지 않았다.
- `policy-tests.log`, `targeted-tests.log`: 정책 4/4, 정책 포함 집중 9/9 통과.
- `all-typecheck.log`: 웹·모바일 타입 검사 통과.
- `comparison.json`: 동일 예약·상태·금액·입금자·기한, PNG 크기·해시 검증.
- `safety.json`: 기존 비테스트 보호자·예약·준비 데이터 해시 불변, 기존 환경설정 네 파일 불변, 외부 발송 0.

테스트는 기존 `deposit-preview-12b5026a` 전용 가상 매장 A1/A2와 완료된 J만 사용했다. 이번 작업의 영속 테스트 데이터 신규 생성은 없고, SQL 임시 변경은 원복했다. A1/A2는 기존 확정·20,000원 상태로 되돌렸으며 정정/취소/재확인 감사는 보존했다. 마지막 가상 매장 집계는 보호자10·반려동물12·예약14·원장11이다. 기존 실데이터나 예약 메모를 일괄 변경·삭제하지 않았다.

## 확인 한계·실행 자원

- 최초 before 캡처 후 CDP detach 시점의 뷰포트 메타데이터 검사 1회가 실패했다. 그 실패 JSON을 숨기거나 통과로 바꾸지 않았다. 원본 PNG는 덮어쓰지 않았고, 실제 픽셀 크기와 동일 DB 상태를 별도로 대조했다. 최종 앱·브라우저 30항목은 재실행 통과 기록이다.
- 이미지의 ‘1 Issue’는 Next 개발 도구 배지다. 상세 원인은 이번 범위에서 확인하지 못했다. 제품 문구로 숨기거나 캡처를 편집하지 않았다. 검사 대상 이동 버튼은 실제 포인터·키보드로 접근 가능했지만 배지와 겹쳐 보이는 보조 버튼은 개발 도구가 없는 운영 표시와 별개다.
- 이번에 만든 QA 탭은 정상/중단 경로 모두 닫았다. 새 브라우저·개발 서버는 시작하지 않았다. 기존 사용자 요청 Chrome11572와 Next24064는 소유권 확인 후 유지했다.
- 운영 DB 변경·운영 배포·push·실제 메시지 발송 없음. 운영 알림톡 승인·지속 스케줄러·환불 법률 검토는 기존 별도 준비 항목 그대로다.

이 세 항목을 마무리했으며, 추가 개발 없이 대표의 최종 화면 확인을 기다린다.
