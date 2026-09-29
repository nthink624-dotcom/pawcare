# Supabase migration drift readback

2026-09-29 read-only `list_migrations` 결과를 저장소의 `supabase/migrations` 파일명과 migration 이름 기준으로 대조했다. 원격 버전 숫자는 과거 적용 시점에 재기록된 값이 있어 파일 timestamp와 직접 비교하지 않고 정규화된 이름으로 비교한다.

| 대상 | 원격 migration 수 | 저장소에 있으나 원격에 없는 migration 수 | 상태 |
| --- | ---: | ---: | --- |
| 운영 `ysxykikqnneuhypybjry` | 121 | 32 | 승인 전 적용 금지 |
| 개발 `qefxdtmdtvnzgupmjlom` | 146 | 8 | 승인 전 적용 금지 |

운영 미적용 범위에는 계정 삭제 계약, 가입·본인확인 보강, 결제/예약 테넌트 무결성, rate limit, 예약 시간 경계, 미디어 무결성, 방문 체중·마케팅 활동 등의 migration이 포함된다. 개발 미적용 범위에는 최근 billing·예약 겹침 보강, 미디어 보존, 공개 DB 보안 보강이 포함된다.

이번 턴에는 migration을 적용하거나 원격 migration history를 수정하지 않았다. 적용 전 순서는 다음과 같다.

1. 개발 DB에 저장소 migration을 순서대로 dry-run/readback한다.
2. 개발 기능·RLS·테넌트 격리·복구 계약을 다시 통과시킨다.
3. 운영 승인 후 동일 migration set을 적용하고, `list_migrations`, RLS/ACL 검증, health/readiness를 readback한다.

새 ACL hardening 및 중복 인덱스 migration도 이 drift에 포함되며, 현재 양쪽 원격 DB에는 적용되지 않았다.

## 현재 원격 history 재확인 (2026-09-29)

Supabase `list_migrations`를 다시 읽은 결과, 원격 DB에 실제로 기록된 최신 migration은 다음과 같다.

| 대상 | 원격 최신 version | 저장소의 최신 migration | 이번 턴 판단 |
| --- | --- | --- | --- |
| 운영 `ysxykikqnneuhypybjry` | `20260928124710` (`20260824042550_add_price_guide_source_media_kind`) | `20260929131500_revoke_policyless_browser_grants.sql` | 2026-09-29 두 migration 미적용 |
| 개발 `qefxdtmdtvnzgupmjlom` | `20260926204624` (`20260926130000_catch_call_reservation_flow`) | `20260929131500_revoke_policyless_browser_grants.sql` | 2026-09-29 두 migration 미적용 |

따라서 저장소의 `20260929130000_remove_redundant_notification_index.sql`와
`20260929131500_revoke_policyless_browser_grants.sql`는 개발·운영 어느 쪽에도 적용되지 않은 상태다.
이번 확인은 읽기 전용이며, migration 적용·history repair·원격 ACL 변경은 수행하지 않았다.

## 개발 guarded dry-run 결과

`npm run supabase:db:reconcile:dev:dry-run`을 실행했지만 migration 적용 전 단계에서 다음 오류로 중단됐다.

```text
DbPushMissingLocalError: Remote migration versions not found in local migrations directory.
20260922031133 20260922031431 20260922033440 20260926204611 20260926204624
```

CLI가 제안한 `supabase migration repair --status reverted` 또는 `supabase db pull`은 원격 migration history나 로컬 정본을 변경할 수 있으므로 승인 전에는 실행하지 않는다. 먼저 각 version이 어떤 로컬 migration 이름에 대응하는지 확인하고, 개발 프로젝트를 기준으로 history 복구 방식을 승인해야 한다.

실수 방지를 위해 저장소에는 `npm run supabase:migration:repair:dev:dry-run`과 명시적 확인 문자열·사유가 필요한 `npm run supabase:migration:repair:dev` wrapper를 추가했다. wrapper는 개발 ref만 허용하며, 실제 repair는 이번 작업에서 실행하지 않았다.

| 원격 version | 원격 name | 저장소의 논리 migration |
| --- | --- | --- |
| `20260922031133` | `harden_sensitive_shared_data_rls` | `20260922100000_harden_sensitive_shared_data_rls.sql` |
| `20260922031431` | `add_explicit_sensitive_data_deny_policies` | `20260922102000_add_explicit_sensitive_data_deny_policies.sql` |
| `20260922033440` | `media_transient_retention_60_days_reconcile` | 별도 저장소 파일 없음 — 확인 필요 |
| `20260926204611` | `20260921120000_call_id_foundation` | `20260921120000_call_id_foundation.sql` |
| `20260926204624` | `20260926130000_catch_call_reservation_flow` | `20260926130000_catch_call_reservation_flow.sql` |

## Follow-up readback after migration fetch (2026-09-29)

The five remote-only versions above were fetched from the linked development
project with the read-only command below. No database write was performed, and
the original migration directory was preserved before the fetch:

```text
npx supabase --workdir . migration fetch --linked
```

`npx supabase --workdir . migration list --linked` now reports local/remote
matches for `20260922031133`, `20260922031431`, `20260922033440`,
`20260926204611`, and `20260926204624`. The fetched files are retained in
`supabase/migrations/` so future dry-runs do not lose the remote history.

The migration counts and missing-file table earlier in this document are the
pre-fetch snapshot and are historical. The current local directory contains
158 uniquely versioned files; the five fetched versions now match the linked
development history. The remaining 12 local-only versions are intentionally
not treated as applied until a separate rollout approval is recorded.

The normal guarded dry-run now stops on a different, explicit condition:

```text
DbPushMissingRemoteError: Found local migration files to be inserted before the last migration on remote database.
```

With `--include-all --dry-run`, Supabase lists 12 local-only migrations that
would be written to the development database. They include the two new SaaS
hardening migrations (`20260929130000` and `20260929131500`). No migration was
applied. The next step requires an approved migration rollout plan and a
separate development DB write approval; production remains untouched.

The exact development dry-run set is:

```text
20260818100210_appointment_staff_memo.sql
20260914145435_single_monthly_billing_contract_v2.sql
20260914214756_repair_appointment_atomic_write_overlap_guard.sql
20260919142648_production_signup_billing_corrective.sql
20260921095436_media_transient_retention_60_days.sql
20260921114000_close_public_database_security_gaps.sql
20260921120000_call_id_foundation.sql
20260922100000_harden_sensitive_shared_data_rls.sql
20260922102000_add_explicit_sensitive_data_deny_policies.sql
20260926130000_catch_call_reservation_flow.sql
20260929130000_remove_redundant_notification_index.sql
20260929131500_revoke_policyless_browser_grants.sql
```
