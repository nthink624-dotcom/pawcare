# Backup and restore readback

## Local PostgreSQL fixture

- Command: `npm run check:backup-recovery:local`
- Result: `POSTGRES_SIGNUP_REPAIR_BACKUP_RESTORE_ROLLBACK_PASS`
- Scope: temporary PostgreSQL 18 cluster under the OS temp directory; no Supabase or other remote connection.
- Verified: fixture schema creation, `pg_dump`, `pg_restore`, post-restore assertions, mutation/rollback guard, and temporary-cluster cleanup.

## Encrypted remote backup guard

- Command: `npm run check:backup-recovery:preflight`
- Result: `PM_DEV_ENCRYPTED_BACKUP_PREFLIGHT_PASS`
- Verified: development target allowlist, `PMDUMP02`, AES-CBC plus HMAC-SHA256 file round-trip, local tool availability, zero remote writes, and no network access.
- Pending: an actual encrypted dump from `petmanager-dev` still requires the protected DPAPI password and CA files. No remote credential was present, so no remote backup or restore was attempted.

## Production and media boundary

- Command: `npm run media:schema-rest-check --workspace=@petmanager/web`
- Result: development-only readback returned HTTP 200 for all six media tables and `storage.petmanager-media`.
- The bucket readback confirmed the bucket exists; production R2 lifecycle and object-restore settings remain unverified.
- Supabase production PITR/daily-backup settings and Cloudflare R2 lifecycle/restore evidence require account readback before launch.
- A database restore does not restore Storage or R2 objects; media restore must remain a separate verification step.
