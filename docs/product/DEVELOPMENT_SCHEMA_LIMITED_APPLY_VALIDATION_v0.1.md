# DEVELOPMENT_SCHEMA_LIMITED_APPLY_VALIDATION v0.1

일자: 2026-08-27  
판정: **BLOCKED — migration 적용 0, 합성 E2E 미실행**

## 대상 환경 확인

- Development: `petmanager-dev`, project ref `qefxdtmdtvnzgupmjlom`, DB host `db.qefxdtmdtvnzgupmjlom.supabase.co`, region `ap-southeast-2`, `ACTIVE_HEALTHY`.
- Production: `petmanager`, project ref `ysxykikqnneuhypybjry`, DB host `db.ysxykikqnneuhypybjry.supabase.co`, region `ap-southeast-1`, `ACTIVE_HEALTHY`.
- 두 프로젝트의 ref, host, region이 모두 다릅니다.
- 로컬 Supabase link file도 `qefxdtmdtvnzgupmjlom`을 가리킵니다.
- 실제 shop, 실제 사용자, 운영 데이터는 조회·변경하지 않았습니다.

## Backup/PITR 선행 점검

- 조직 플랜은 Supabase `Free`입니다.
- Supabase 공식 문서상 자동 일일 백업은 Pro/Team/Enterprise 프로젝트에 제공되며, Free 프로젝트는 CLI `db dump` 등으로 별도 off-site 논리 백업을 만들어야 합니다.
- PITR은 Pro/Team/Enterprise에서 추가 기능으로 활성화하는 계약이며 현재 Free 조직에는 해당 복구 근거가 없습니다.
- Development project branch 목록은 비어 있어 격리 branch restore 대상도 없습니다.
- 로컬 격리 PostgreSQL에서 forward → `pg_dump` → `pg_restore` → reverse rollback은 이전 보안 패킷에서 통과했지만, 이는 현재 원격 Development 데이터의 사전 백업이 아닙니다.
- 현재 환경에는 standalone/local Supabase CLI binary가 없고 `npx supabase`도 registry 접근 실패로 실행되지 않아 원격 Development의 사전 logical dump와 격리 restore 검증을 만들 수 없었습니다.

따라서 운영 지시의 "backup/PITR 상태와 격리 복구 가능성을 먼저 확인하고, 전제가 없으면 적용 금지" 조건에 따라 원격 migration 적용을 중단했습니다.

## 감사된 pending 5개 — 미적용

| 순서 | Migration | SHA-256 |
|---:|---|---|
| 1 | `20260826034028_secure_owner_shop_memberships.sql` | `84b3fce7ec2f4877089df15c2ba0e39fbfed7a8996e540234259d621c79f5617` |
| 2 | `20260826111854_lock_product_booking_defaults.sql` | `28f216ed45f95fde4f037e7f9c2a2ddcf6b3dccc7b2f8688121351b0a2e4b18b` |
| 3 | `202608270001_atomic_owner_signup_draft.sql` | `e0393ed60397778fc80c772d5fbc0e2451ebbedc1b7856f1e636bf38c2c0f22e` |
| 4 | `20260827020524_secure_signup_ai_price_guide.sql` | `5f8c4e0f600e41c2d84effd387ea53549a562e7fa561b87855b30cfa6fdcaa14` |
| 5 | `20260827031414_secure_signup_ai_price_guide_metering.sql` | `ef83c86f924439ff38725664cfe1dc6d6ee00d50d28cbc737236deb5de64bb93` |

`npm run verify:signup-repair` 결과는 `target=Development:qefxdtmdtvnzgupmjlom`, `apply=false`, `failures=[]`입니다.

## 원격 미변경 post-check

- 원격 migration history 마지막 항목은 계속 `20260826130954_marketing_work_ledger`입니다.
- `owner_shop_memberships`, `signup_idempotency_requests`, `signup_price_guide_analysis_requests`, `complete_owner_signup_v2`는 원격 Development에 존재하지 않습니다.
- DDL, migration history write, Auth 계정 생성, Storage 파일 생성, Vision/provider 호출은 모두 0입니다.
- F rollout/feature gate 설정은 변경하지 않았고 기본 OFF 경계를 유지했습니다.

## 합성 fixture 상태

- 계획 fixture: 합성 owner/Auth identity, 합성 shop, 합성 서비스·가격, 합성 가격표 이미지, 동일 idempotency key 재시도, payload mismatch, anon/auth/service-role RLS matrix, 64KiB direct-main body cap.
- 실행 상태: **미실행**. 원격 backup/restore 전제가 충족되지 않은 상태에서 schema apply 또는 신규 합성 계정 생성을 진행하지 않았습니다.

## 정확한 blocker와 다음 안전 행동

Blocker: Development가 Free 플랜이며 확인 가능한 자동 백업/PITR/restore point가 없고, 현재 호스트에서 사전 logical dump를 생성·격리 복원할 Supabase CLI 실행 경로도 없습니다.

다음 안전 행동은 둘 중 하나입니다.

1. Development를 자동 백업이 제공되는 플랜으로 전환하고 실제 backup/restore point를 확인한 뒤 제한 적용을 재개합니다.
2. 승인된 Supabase CLI/DB 자격 경로로 암호화된 off-site logical dump를 만들고 격리 PostgreSQL restore 검증을 통과한 뒤 제한 적용을 재개합니다.

어느 경우든 Production, 실제 사용자·운영 데이터, 실제 Vision 호출은 계속 금지합니다.
