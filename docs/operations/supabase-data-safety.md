# Supabase data safety runbook

## Default target

- This workspace's local Supabase CLI must remain linked to `petmanager-dev` (`qefxdtmdtvnzgupmjlom`).
- Verify before any database action:

  ```powershell
  npm run check:supabase-cli-target:dev
  ```

- Use only the guarded command below. Do not run `npx supabase db push` directly from this workspace.

  ```powershell
  npm run supabase:db:push:dev
  ```

## Production database changes

Production writes are intentionally blocked unless the operator explicitly supplies both the target ref and a change reason.

```powershell
$env:PETMANAGER_SUPABASE_PRODUCTION_CONFIRMATION = "ysxykikqnneuhypybjry"
$env:PETMANAGER_SUPABASE_CHANGE_REASON = "승인된 변경 내용"
npm run supabase:db:push:prod:dry-run
```

Review the dry-run output first. Run `npm run supabase:link:prod`, then `npm run supabase:db:push:prod` only after the approved migration and target are confirmed. Each guarded command verifies the linked project and prints the target before it runs. After a production command, immediately run `npm run supabase:link:dev` to return this workspace to its safe default.

## Deletion protection

- Owner withdrawal soft-deletes shops through `shops.deleted_at`; deleted shops are unavailable to public booking/bootstrap routes and hidden from the active admin owner list.
- Hard deletes of shops, owner profiles, appointments, guardians, pets, services, staff members, and grooming records write an immutable, redacted event row to `data_deletion_audit`; row JSON, identifiers, and actor values are not retained there.
- `TRUNCATE` is blocked for those tables.
- `data_deletion_audit` has RLS enabled, no browser role privileges, and is backend-only. It is an event ledger, not a pre-delete data recovery store.
- Owner self-deletion is server-only: current-password reauthentication, global session revocation, media cleanup, database purge, and Supabase Auth soft deletion must complete in that order. Idempotency keys are stored only as SHA-256 hashes. Accounts with active billing, or billing records lacking an approved retention basis and period, must fail closed.
- Destructive auth/capture smoke scripts require `SUPABASE_ENV_NAME=test`; they must not run with the development or production environment file.

## Recovery and backup policy

- Before production launch, enable a Supabase backup option appropriate to the production plan. Daily backups and PITR recovery settings are managed in the Supabase Dashboard.
- Maintain an encrypted off-site logical dump for the development project. The backup destination, retention period, and encryption key owner must be approved before automating exports because backups contain customer personal data.
- Use a dedicated third `test` Supabase project for destructive smoke and capture scripts. It must use a unique project ref and `SUPABASE_ENV_NAME=test`; it must never reuse development or production credentials.
- Verify backup restoration into an isolated project at least quarterly. A backup that has never been restored is not a verified recovery path.
- A database backup does not restore Supabase Storage or Cloudflare R2 objects; media provider retention and restore verification are a separate requirement.
- Before obtaining protected development credentials, run `powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-development-encrypted-backup-restore.ps1 -Preflight`. This checks the exact development target allowlist, local PostgreSQL tools, and the Windows-compatible AES-CBC + HMAC-SHA256 authenticated archive round trip without network access or database writes.
- To verify PostgreSQL dump/restore mechanics without any remote credential, run `npm run check:backup-recovery:local`. It creates a temporary local cluster, dumps and restores a fixture, checks the restored assertions, and removes the cluster. It must finish with `POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS`.
- After applying the approved ACL hardening migration, run `supabase/verification/verify_policyless_rls_acl.sql` against development and production. The expected result is `policyless_rls_with_browser_grants = 0`; this is a read-only verification and does not apply the migration.
- Run `supabase/verification/verify_public_browser_table_grants.sql` against both projects to find any `anon`/`authenticated` table-level privileges, including tables that have an RLS policy. It must return zero rows; RLS policies do not replace least-privilege table grants.
