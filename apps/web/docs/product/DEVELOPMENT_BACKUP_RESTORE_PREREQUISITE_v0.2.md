# DEVELOPMENT BACKUP-RESTORE PREREQUISITE v0.2

일자: 2026-08-27  
판정: **보안 precheck 적합 / BLOCKED — Development read-only DB 인증 경로 필요**  
원격 변경: **0**

보안팀은 no-apply, 승인 없는 dump 0, PostgreSQL 18 binary checksum을 적합으로 확인했습니다. 아래 acceptance를 모두 통과하기 전 dump/apply는 0을 유지합니다.

## 환경 fail-closed 확인

- Development: `petmanager-dev`, ref `qefxdtmdtvnzgupmjlom`, host `db.qefxdtmdtvnzgupmjlom.supabase.co`, region `ap-southeast-2`.
- Production: `petmanager`, ref `ysxykikqnneuhypybjry`, host `db.ysxykikqnneuhypybjry.supabase.co`, region `ap-southeast-1`.
- project ref, DB host, region이 모두 다르고 local project link와 저장된 pooler URL은 Development로 분류됩니다.
- Production ref/host가 감지되거나 target이 불명확하면 dump/apply를 실행하지 않는 경계입니다.

## 기존 도구 탐색

Docker와 Supabase CLI binary는 없지만 option B에 필요한 공식 PostgreSQL 도구는 이미 설치되어 있어 새 다운로드가 필요 없습니다.

| 도구 | 버전 | SHA-256 |
|---|---|---|
| `pg_dump.exe` | PostgreSQL 18.4 | `f2f9ca442732ed855adf67e2b8a8ba61ee5799aa631f013c5b724e73da8e1f4c` |
| `pg_restore.exe` | PostgreSQL 18.4 | `cfdaacb2a9ede07769bea9ba3f6c8485a622545fb1c929acd8f98230017a40b2` |
| `psql.exe` | PostgreSQL 18.4 | `b837d9bdfeaf1dcd17dd5347af848dca290a09394abb6d2186e87f34293f0dfe` |
| `initdb.exe` | PostgreSQL 18.4 | `acf1b9cb9a2c670f290a747365b8945d66ddeedabc027d80e2d7e1749ac7a8ce` |
| `pg_ctl.exe` | PostgreSQL 18.4 | `e8da3e874baab290a3a9da4d7ef11879724d23562aaf4cf83fd4502b3f89fc8e` |
| `postgres.exe` | PostgreSQL 18.4 | `becadfa646f4576467452ec94c513b1414e8bfeedc36f63e94d37c55219206ff` |

설치 경로: `C:\Program Files\PostgreSQL\18\bin`.

## 인증 경로 탐색

다음 위치를 값 노출 없이 존재 여부와 target만 검사했습니다.

- process environment: `DATABASE_URL`, `DIRECT_URL`, `POSTGRES_URL`, `SUPABASE_DB_URL`, `SUPABASE_DB_PASSWORD`, `SUPABASE_ACCESS_TOKEN` 모두 없음.
- `D:\petmanager\.env.local`: 위 DB credential 없음.
- `D:\petmanager-shared\env\petmanager.env.local`: 위 DB credential 없음.
- Supabase user config: access token 없음.
- `supabase/.temp/pooler-url`: Development target이지만 embedded password 없음.
- `supabase/.temp/project-ref`와 `linked-project.json`: Development ref 일치.

따라서 승인된 read-only DB 인증 없이 pg_dump를 시도하지 않았습니다. 비밀값, connection string, row data는 출력·로그·artifact에 남지 않았습니다.

## 필요한 권한 1건

**Development `qefxdtmdtvnzgupmjlom` 전용의 승인된 임시 read-only DB 연결 자격을 로컬 secret 주입 경로로 제공해 주세요.**

- scope: connect + `public`, 필요한 `auth`, migration history/schema metadata의 dump에 필요한 read-only 권한만.
- target allowlist: Development host/ref exact-match만. Production credential/host 금지.
- 전달 방식: 채팅·파일 평문 금지. 현재 프로세스 또는 승인된 secret store에 임시 주입하고 값은 출력하지 않음.
- 사용 목적: `pg_dump` 1회 → 암호화 artifact hash 고정 → 네트워크 분리 임시 PostgreSQL restore/assertion → 즉시 폐기.
- 만료: restore 증거 확정 직후 credential 제거/rotation 가능한 일회성 또는 단기 자격.

## 자격 수신 후 실행 체크포인트

1. exact Development ref/host와 TLS certificate/hostname 검증. mismatch, unknown, TLS 검증 실패면 즉시 중단.
2. dump 전 read-only probe: `public`, 필요한 `auth`, `supabase_migrations`에 필요한 read 권한만 있는지 확인. 권한 부족 또는 쓰기 권한이 필요한 경로면 중단.
3. 검증된 암호화 recipient/key와 access-restricted 임시 위치를 준비. 평문 dump artifact는 생성하지 않으며 key material을 로그·manifest에 남기지 않음.
4. `pg_dump` consistent snapshot으로 `public` + 필요한 `auth` + `supabase_migrations` schema/history를 논리 dump.
5. 암호화 artifact의 SHA-256 manifest를 생성하고 대상 ref, tool version, schema scope만 기록. credential, connection string, row data, encryption key는 제외.
6. 로컬 네트워크 분리 PostgreSQL 18에 복호화 stream으로 restore하고 평문 dump 파일 0을 유지.
7. schema/history/count/fingerprint 및 pending 5 적용 전 baseline assertion. 불완전 restore면 remote apply 금지.
8. PASS 뒤에만 감사된 pending 5를 Development에 순서대로 적용하고 합성 fixture 실행.
9. 증거 확정 후 credential, encryption key, encrypted dump, 임시 DB/process를 cleanup하고 temp listener 0을 확인.

즉시 중단 조건: 승인된 자격 부재, exact qef host/ref 또는 TLS 불일치, read probe 실패, 검증된 암호화 recipient/key 부재, 평문 artifact 생성 가능성, consistent snapshot 실패, hash mismatch, isolated restore/assertion 실패. 하나라도 발생하면 dump/apply 0을 유지합니다.

## 현재 보존된 안전 상태

- remote migration apply/DDL/history write: 0.
- Auth/Storage/실제 사용자/Vision/provider 호출: 0.
- F rollout gate: 변경 0, 기본 OFF.
- 원격 history 마지막: `20260826130954_marketing_work_ledger`.
- 신규 membership/signup/analysis schema: 미존재.
