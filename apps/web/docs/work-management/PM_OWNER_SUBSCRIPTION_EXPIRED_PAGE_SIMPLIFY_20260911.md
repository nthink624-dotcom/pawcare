# 서비스 이용 종료 화면 간소화

- `parent_work_id`: `PM_OWNER_SUBSCRIPTION_EXPIRED_PAGE_SIMPLIFY_20260911`
- `UI_GATE`: `Y`
- `lane`: `owner-billing-ui`
- 현재 단계: `04-independent-ui-qa-rerun` PASS
- frozen source: `src/components/owner/owner-service-expired-screen.tsx`
- frozen source SHA-256: `A69EF11B48C456BF968F13D1F901CE4ACAA4A841C3083486C90CE6E74888950E`
- focused contract SHA-256: `A11C95E276CAF073CBEB7AC66D68E153666B5D9D04485CBE26A70B8EF2940951`

## 확정 UI 도면

- 상단 브랜드와 `다른 계정으로 로그인`은 유지한다.
- 본문은 중앙 최대 560px의 흰색 단일 카드다.
- 제목은 expired `이용 기간이 종료되었습니다`, past_due `결제를 완료해 주세요`다.
- 설명은 `기간을 연장하면 바로 다시 이용할 수 있습니다.` 한 문장만 둔다.
- 사실 정보는 `서비스 종료일`, `마지막 이용 플랜` 두 행만 유지한다.
- 주 행동은 navy `기간 연장하기`, 보조 행동은 텍스트형 `결제·이용 문의`다.
- 브랜드 이미지 외 Lucide/장식 아이콘, 안내 배지, 보관 설명 3카드, 파란 안내 상자, 반복 설명, gradient와 장식 shadow를 제거한다.
- 기존 expired/past_due notice, free→monthly 재개 플랜, billing href, mailto, logout/loading 의미는 바꾸지 않는다.

## 독립 검수 기준

- 실제 1440/1024/430/390과 200% text-spacing에서 Korean clip·요소 겹침·document x-overflow 0.
- 카드 폭은 560px 이하이고 좁은 화면에서는 좌우 20px 여백 안에 들어온다.
- 브랜드 외 아이콘 0, 반복 안내·중첩 카드·gradient·장식 shadow 0.
- 로그아웃, 연장, 문의 target은 실제 높이 44px 이상이고 keyboard focus-visible이 보인다.
- expired와 past_due 제목, 종료일·플랜, free→monthly, exact billing notice/plan query, mailto 접근성 이름을 확인한다.
- 실제 결제·메일 전송·로그아웃은 실행하지 않는다. console/page error와 unexpected request 0.
- canonical 3000은 건드리지 않는다. 필요 시 task-owned 3117 서버/격리 브라우저만 사용하고 종료한다.
- P0/P1=0이고 위 기준이 모두 실제 렌더 PASS일 때만 완료한다.

## 독립 검수 결과

- 2026-09-11: expired/past_due 각각 1440/1024/430/390 PASS.
- 390px + 200% 확대·텍스트 간격에서 x-overflow 0, 제목·헤더 clip 0.
- 브랜드 외 아이콘, 중첩 카드, gradient, 장식 shadow 0.
- 로그아웃/연장/문의 target 44/45/44px, keyboard focus-visible PASS.
- 종료일·플랜·free→monthly·expired/past_due query·mailto 접근성 이름 PASS.
- focused contract 1/1, TypeScript, scoped ESLint, diff-check PASS.
- P0 0 / P1 0.
