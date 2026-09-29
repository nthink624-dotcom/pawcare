# Alimtalk production environment readback

Date: 2026-09-29

Command:

```text
npm run check:alimtalk-env:vercel
```

This command performs a read-only Vercel production environment pull into a
temporary file and deletes that file after comparison. It does not set, remove,
or overwrite any Vercel variable.

Result:

- Protected production values for `ALIMTALK_RELAY_SECRET` and
  `ALIMTALK_SENDER_KEY` were present.
- `ALIMTALK_RELAY_URL` and `ALIMTALK_RELAY_ADMIN_URL` were missing.
- Production template IDs were missing for booking confirmation/cancellation,
  time proposal, reschedule confirmation, reminders, and grooming
  started/almost-done/completed notifications.
- The command exited non-zero by design. No Vercel environment value changed.

This is a production configuration blocker. It must be resolved through an
explicitly approved Vercel environment update and then rechecked before any
production deployment.

The repository sync helper is fail-closed: use `--dry-run` to preview changes;
an actual write requires `PETMANAGER_VERCEL_ENV_CONFIRMATION` equal to the
target environment and a non-empty `PETMANAGER_VERCEL_ENV_CHANGE_REASON`.
