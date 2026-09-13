# 공개정책 배포 전 기준선 기록 (R2)

기준일: 2026-09-02 (KST)  
목적: 공개정책만 안전하게 배포하기 위한 범위와 검증 결과를 기록한다. 이 문서는 배포 지시나 커밋·스테이징 지시가 아니다.

## 1. 현재 작업공간 검증

- `npm run lint`: PASS
- `npm run typecheck`: PASS
- `git diff --check`: PASS (CRLF 변환 경고만 존재)
- 전체 `npm run predeploy`: FAIL — 빌드 전 `tests/server/reliability-guardrails.test.mjs`의 관리자 홈 계약 3건이 현재 dirty 관리자 화면과 맞지 않는다. 공개정책 파일과 무관하므로 이 작업에서 변경하지 않는다.

## 2. lint 4건 원인과 최소 수정

| 파일 | 원인 | 수정 |
|---|---|---|
| `src/components/admin/admin-support-request-screen.tsx` | 첫 문의 로딩이 effect 안에서 즉시 상태를 갱신 | 동일 로딩을 다음 animation frame에서 시작하고 cleanup에서 취소 |
| `src/components/customer/customer-booking-entry-page.tsx` | 미리보기 서비스 선택을 effect 안에서 즉시 상태에 반영 | 동일 선택을 다음 animation frame에서 반영하고 cleanup에서 취소 |
| `src/components/owner-web/owner-initial-setup-guide.tsx` | portal 대상 설정이 effect 안에서 즉시 상태를 갱신 | 동일 portal 설정을 다음 animation frame에서 반영하고 cleanup에서 취소 |
| `src/components/owner-web/staff-profile-photo-field.tsx` | 사진 미리보기 URL 설정이 effect 안에서 즉시 상태를 갱신 | 동일 URL 생성·해제를 다음 animation frame으로 옮기고 cleanup 보존 |

ESLint가 읽지 않아야 하는 로컬 비밀 폴더는 `eslint.config.mjs`에서 `.local-secrets/**`만 추가로 제외했다. 제품 코드·비밀값은 읽거나 출력하지 않았다.

## 3. clean release baseline 제안

현재 `D:\petmanager`에는 공개정책과 무관한 tracked/untracked 변경이 다수 있으므로, 이 작업공간에서 직접 Vercel 배포를 실행하지 않는다.

새 clean baseline은 수용된 기준 커밋에서 만들고 아래 공개정책 allowlist의 **검증된 hunk만** 적용한다.

1. `src/components/landing/landing-page.tsx`
2. `src/components/landing/landing-conversion-sections.tsx`
3. `src/app/refund/page.tsx`
4. `src/lib/auth/owner-paid-service-terms.ts`
5. `src/lib/auth/owner-signup-terms.ts`
6. 해당 기준선에서 lint가 같은 로컬 비밀 폴더를 검사할 때만 `eslint.config.mjs`의 `.local-secrets/**` 제외 한 줄

`admin-support-request-screen.tsx`, `staff-profile-photo-field.tsx`는 현재 HEAD에 없는 다른 작업 파일이고, `customer-booking-entry-page.tsx`, `owner-initial-setup-guide.tsx`는 큰 사용자 변경을 포함한다. 따라서 이 네 lint 수정은 현재 작업공간 검사에는 반영됐지만, 공개정책 release allowlist에는 각 파일의 원래 writer가 수용할 때만 포함한다.

clean baseline에서 lint·typecheck·build·smoke·e2e가 모두 통과하고 독립 UI 검수가 완료된 뒤에만 배포 여부를 다시 판단한다.

## 4. 보존한 공개정책 사실

- 월 29,000원, VAT 포함
- 구독 1개당 매장 1곳, 직원 수 제한 없음, 다점포는 매장별 별도 구독
- 14일 무료체험, 시작 시 카드 불필요, 체험 종료 자동결제 없음
- 환불·청약철회는 고객센터 접수 후 관련 법령과 실제 제공 여부를 기준으로 안내
