# 개인정보 운영 매트릭스

이 문서는 공개 개인정보처리방침, 실제 코드 경로, 운영 계정 설정을 서로 대조하기 위한 내부 체크 문서다. 코드에 있는 설명만으로 외부 사업자의 보관·학습·백업 정책을 확정하지 않으며, 운영 계정 readback과 계약 증거가 없는 항목은 미확정으로 남긴다.

## 현재 코드로 확인된 흐름

| 흐름 | 저장·처리 위치 | 현재 구현 근거 | 운영 확인 상태 |
| --- | --- | --- | --- |
| 계정·매장·예약·고객·반려동물 데이터 | Supabase 데이터베이스 | `docs/shared/data-contracts.md`, owner tenant/auth guard, 개발 DB RLS 검증 | 개발 DB 확인; 운영 DB readback 필요 |
| 미디어 원본·파생본 | 선택된 media storage provider, 기본 경로는 Supabase/R2 추상화 | `apps/web/src/server/media-storage.ts`, `check:media-architecture` | R2 bucket·lifecycle·백업 설정 readback 필요 |
| 일시 미디어 | `transient/` 경로, 60일 정리 작업 | `supabase/migrations/20260921095436_media_transient_retention_60_days.sql`, `media-retention-policy-contract.test.mjs` | 스케줄 실행·실제 삭제 readback 필요 |
| 가격표 사진 분석 | 파생 이미지 1장만 OpenAI Responses로 전송, `store:false` 옵션 | `apps/web/src/lib/legal/privacy-policy.ts`, price-guide tests | OpenAI 계정·계약·보관 정책 readback 필요 |
| 케어리포트 AI | 기능 활성화 시 텍스트만 DeepSeek로 전송 | `apps/web/src/lib/legal/privacy-policy.ts`, `apps/web/src/server/care-report-ai.ts` | 활성화 여부·계약·보관 정책 readback 필요 |
| 계정 삭제 | 인증된 owner endpoint가 세션 폐기, 미디어 잔여 확인 후 terminal RPC | `POST /api/owner/account-deletion`, `Owner Account Deletion Contract` | 개발 계약 테스트; 운영 RPC·Auth·Storage E2E 필요 |

## 권리 요청 상태

- 공개 개인정보처리방침: `/privacy`에서 `PUBLIC_PRIVACY_POLICY`를 렌더링한다.
- 계정 삭제: `/account-deletion`에서 로그인·현재 비밀번호·명시적 확인·idempotency key를 요구한다. 이메일만으로 계정 존재 여부를 열거하지 않는다.
- 정정·열람·처리정지·선택 동의 철회: 고객센터/설정 경로를 통해 처리한다. 실제 운영 담당자와 SLA는 별도 readback이 필요하다.
- 데이터 내보내기: `GET /api/owner/data-export?shopId=...`에서 owner bearer 세션과 명시적 매장 범위를 확인한 뒤 rate limit을 적용하고 JSON으로 계정·매장·예약·고객·반려동물·미용 기록·알림 이력을 내보낸다. 미디어 바이너리, 인증 비밀값, 결제 자격증명, provider token, 내부 감사 행은 포함하지 않는다.

## 자동 검사와 증거

- `npm run check:privacy-operations`는 공개 정책, 삭제 endpoint 안전장치, 미디어 잔여 검증, 공용 계약 문서의 존재를 검사한다.
- `npm run check:saas-readiness`는 위 검사를 포함해야 하며, 이 검사는 외부 provider의 실제 보관·삭제·백업 설정을 증명하지 않는다.
- 운영 전환 전에는 provider별 설정 readback, 계정 삭제 실제 E2E, 데이터 내보내기 결정, 개인정보 처리 담당자·SLA를 `docs/operations/saas-readiness-evidence.md`에 기록한다.
