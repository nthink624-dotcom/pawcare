# Production launch gate

This is a manual, read-only cutover check. It must be run only after the approved commit is pushed and both Vercel projects have a production deployment.

Before pushing the approved release, run the repository-wide predeploy gate:

```powershell
npm run predeploy:release
```

It covers both web and mobile builds, shared contracts, environment guards,
backup fixtures, and type/lint checks. It does not create a deployment.
The Alimtalk step performs a read-only Vercel production environment pull and
fails closed when relay URLs or approved template IDs are missing.

```powershell
npm run check:production-launch -- --expected-release <40자리 Git SHA>
```

배포 직후에는 동일한 검사를 하나의 명시적인 read-only 명령으로 실행할 수 있다.

```powershell
npm run postdeploy:release -- --expected-release <40자리 Git SHA>
```

이 명령은 두 운영 프로젝트가 예상 release를 제공하고 health/readiness smoke,
보호된 환경 readback, readback 증거 구조 검사를 모두 통과할 때만 성공한다.

The gate requires all of the following:

- `www.petmanager.co.kr` and `app.petmanager.co.kr` return HTTP 200 from both `/api/healthz` and `/api/readyz`.
- Both projects report the exact expected release SHA.
- Readback evidence has matching dates, expected project aliases, valid deployment IDs, and the same SHA for web and mobile.
- The Supabase production readback has no unresolved security WARN for leaked-password protection.
- The Supabase production readback confirms public-table RLS metadata and has no policyless browser grants remaining.
- The Vercel production readback has the required Alimtalk and PortOne payment environment values.
- Production has at least one verified database protection path (daily backup, PITR, or encrypted off-site backup) and a passing isolated database restore drill.
- Production media object recovery/retention is configured and an isolated media restore drill passes; Vercel R2 environment-variable presence alone is not proof.
- The current development cross-tenant fixture passes and verifies zero leftover test rows; contract tests alone are not runtime database proof.
- The readback evidence is updated after the deployment and endpoint smoke.

The command performs GET/read-only checks only. It does not push code, create a deployment, apply a migration, or change an account setting.
