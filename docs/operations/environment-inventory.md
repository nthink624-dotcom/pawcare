# 운영 환경 인벤토리

이 표는 비밀값 없이 배포 대상과 소유 경계를 고정한다. 실제 대시보드 값은 readback으로 확인하기 전까지 `미확인`으로 둔다.

| 구성요소 | 저장소 경로 | 대상·식별자 | 변경 소유자·절차 | 현재 증거 |
| --- | --- | --- | --- | --- |
| 웹·API Vercel | `apps/web` | 프로젝트 `petmanager` (`prj_v3zjDSALc0VTY3yLRaNO5Il43uwO`), `https://www.petmanager.co.kr` | 대표 승인 → `apps/web` 검사 → Vercel production readback | 2026-09-29 최신 production `READY` 배포 `dpl_D6KvYyZLDPUSZV5BCfQ5SBydiUQ3`, SHA `b73f1012d0f5e02e57970cc1ea22ea2167651fba`; 현재 `/api/healthz`·`/api/readyz`는 404 (로컬 미배포 변경) |
| 모바일 웹 Vercel | `apps/mobile` | 프로젝트 `petmanager-app` (`prj_uzTnmmuozy84cziu7T9IL1vOTdK4`), `https://app.petmanager.co.kr/owner/mobile` | 대표 승인 → `apps/mobile` 검사 → Vercel production readback | 2026-09-29 최신 production `READY` 배포 `dpl_BwPvBzxo8efeH8j4uhScqJMyrgMo`, SHA `b73f1012d0f5e02e57970cc1ea22ea2167651fba`; 현재 `/api/healthz`·`/api/readyz`는 404 (로컬 미배포 변경) |
| 개발 Supabase | `supabase/`, `.env.local` | `petmanager-dev` / `qefxdtmdtvnzgupmjlom` | 개발 guard 통과 후에만 CLI 사용 | 2026-09-29 `ACTIVE_HEALTHY`; 저장소 기준 미적용 migration 8개 readback, guarded dry-run은 원격 history 충돌로 중단 |
| 운영 Supabase | `supabase/`, production env | `ysxykikqnneuhypybjry` | target ref·변경 사유·대표 승인 후 guarded command | 2026-09-29 `ACTIVE_HEALTHY`; 저장소 기준 미적용 migration 32개 readback, 백업/PITR·RLS 적용 상태 별도 확인 필요 |
| 미디어 저장소 | `apps/web/src/server/media-storage.ts` | Supabase Storage 또는 Cloudflare R2 provider | provider·bucket·lifecycle 변경은 대표 승인 | `check:media-architecture`; bucket/lifecycle readback 필요 |
| 결제 | `apps/web/src/app/api/webhooks/portone/route.ts` | PortOne/KCP 운영 계정 | 서명키·웹훅·정산 설정은 대표 승인 | 계약 테스트; 실제 웹훅 등록·키·재전송 readback 필요 |
| 알림톡 | `apps/web/src/server/alimtalk-provider.ts` | Ssom?다 relay·카카오 sender profile | 템플릿·sender·relay env 변경은 대표 승인 | 환경 일치 검사; 실제 sender·relay·웹훅 readback 필요 |

## 2026-09-29 읽기 전용 Advisor 확인

- 개발·운영 Supabase 모두 유출 비밀번호 보호 비활성 경고(`auth_leaked_password_protection`, WARN)가 1건씩 있다. 대시보드에서 활성화하는 별도 승인 작업이 필요하다.
- RLS 활성화·정책 없음 INFO는 개발 78건·운영 67건이다. 그중 브라우저 역할 ACL이 남아 있는 서버 전용 테이블을 정리하는 migration(`20260929131500_revoke_policyless_browser_grants.sql`)을 추가했다. 운영 DB에는 승인 전까지 적용하지 않는다.
- 성능 Advisor는 양쪽 모두 중복 인덱스 WARN 1건과 미인덱스/미사용 인덱스 INFO를 보고했다. 중복 제거 migration(`20260929130000_remove_redundant_notification_index.sql`)은 추가했지만 운영 DB에는 아직 적용하지 않았다. 운영 인덱스 변경은 승인·트래픽 근거·migration·readback 후에만 수행한다.

## 금지 사항

- 이 문서와 Git에는 service role key, API key, sender key, relay secret, 결제 secret, JWT, 개인 운영 데이터를 기록하지 않는다.
- `apps/web` 변경을 `petmanager-app`으로 배포하거나 `apps/mobile` 변경을 `petmanager`로 배포하지 않는다.
- 운영 Supabase를 개발 CLI의 기본 대상처럼 사용하지 않는다. 운영 DB 변경은 `verify-supabase-cli-target.cjs`의 명시적 확인과 대표 승인 후에만 실행한다.
- Vercel·Supabase·R2·결제·알림톡의 실제 설정을 확인하지 않은 상태에서 운영 완료로 표시하지 않는다.
