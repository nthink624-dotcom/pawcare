# CALL_ID P0 contract

- Owner route: `/owner/calls`; owner/manager authentication is required by `/api/owner/calls`.
- POC storage is process-local and resets on restart. No production migration is included.
- `CallInteraction`, `CallbackTask`, and `CallBookingDraft` remain separate records.
- Mock events are `inbound_ringing`, `answered`, `ended`, and `missed`; `eventId` is idempotent.
- Phone numbers are normalized only for matching and returned only as masked values. They must not appear in URLs, logs, or analytics.
- A booking draft never changes the appointment status model and never creates an appointment. Explicit confirmation changes it only to `ready_for_booking` for later handoff to the canonical appointment API.
- The notification surface is preview-only and must not call a send endpoint.
- `callDetectionEnabled=false`, `alimtalkSendEnabled=false`, and `externalExecution=false` are invariant.
