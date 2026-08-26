# Marketing work ledger runbook

## Boundary

- Production project: `petmanager` (`ysxykikqnneuhypybjry`).
- Tables: `marketing_work_items`, `marketing_work_events`, `marketing_work_approvals`, `marketing_work_artifacts`, `marketing_work_outbox`.
- Only `source_type = operational` is accepted. Demo replay never writes to these tables.
- `anon` and `authenticated` have no table privileges or ingest-function execute privilege.
- The local gateway makes outbound HTTPS requests only and uses Codex App Server over stdio. It does not listen on a network port.
- Status events never enable deployment, advertising, publishing, messaging, budget changes, or any other external execution.

## Apply and verify

1. Confirm the target project ref and migration history immediately before applying.
2. Apply `20260826110517_marketing_work_ledger.sql` once.
3. Confirm RLS is enabled on all five tables and `anon`/`authenticated` privileges are false.
4. Confirm `ingest_marketing_work_event` is executable by `service_role` only.
5. Set `MARKETING_WORK_EVENT_TOKEN` as a sensitive Production server secret. Never use a `NEXT_PUBLIC_` name.
6. Send one sanitized event twice with the same idempotency key; exactly one event must remain.
7. Send a newer event followed by an older event; the current projection must keep the newer state while retaining both ledger events.

## Rollback

The default rollback preserves audit history:

1. Stop the local gateway and remove/rotate `MARKETING_WORK_EVENT_TOKEN`.
2. Roll back the web deployment to the recorded previous deployment.
3. Revoke `service_role` execute on `ingest_marketing_work_event` if ingestion must be stopped at the database boundary.
4. Keep the five tables read-only for audit. Do not drop or truncate them during an incident.
5. Remove `marketing_work_items` from `supabase_realtime` only if Realtime itself is the failure source.

A destructive table drop is not an operational rollback and requires a separate owner-approved migration after an export and retention review.
