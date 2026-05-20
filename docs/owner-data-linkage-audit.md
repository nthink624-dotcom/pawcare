# Owner Data Linkage Audit

This checklist tracks the operational links that must stay connected across customer booking, owner operations, records, and messaging.

## Core Flow

| Event | Must Write | Must Appear In | Current Status |
| --- | --- | --- | --- |
| Customer submits booking | `guardians`, `pets`, `appointments`, `notifications` | Owner schedule, calendar, customer detail, notification history | Connected |
| Owner creates booking | `guardians`/`pets` when new, `appointments.staff_id` when assigned | Schedule board, calendar, customer detail | Strengthened: staff assignment is now persisted |
| Owner confirms booking | `appointments.status`, `notifications` | Schedule, calendar, customer timeline, notification history | Connected |
| Owner rejects/cancels booking | `appointments.status`, rejection reason, `notifications` | Schedule change/cancel area, calendar, customer timeline | Connected, rejection copy should be reviewed |
| Customer reschedules/cancels | `appointments.status/date/time`, `notifications` | Owner schedule, calendar, customer detail | Connected |
| Grooming starts | `appointments.status = in_progress`, `notifications` | Schedule board active work, customer timeline | Connected |
| Pickup-ready/almost done | `appointments.status = almost_done`, `notifications` | Schedule board, customer timeline | Connected |
| Grooming completed | `appointments.status = completed`, `grooming_records`, `notifications` | Calendar, records, customer detail | Connected |
| Alimtalk send succeeds/fails | `notifications.status`, provider fields, failure reason | Notification history and audit views | Stored, owner-facing history UI needs polish |
| Photos/media sent | `media_assets`, variants, notification attachments | Grooming record, customer-shared message, media usage | Partially connected, needs E2E audit |

## Priority Backlog

1. Persist customer detail edits
   - Guardian name, phone, memo, and notification enabled status should update `guardians`.
   - Pet name edits should update existing `pets`.
   - Status: strengthened for existing guardian and existing pet edits, owner-created customers, and customer detail pet add/delete.
   - Pet deletion is blocked when reservations, grooming records, or notifications are already linked.

2. Persist appointment staff assignment
   - `appointments.staff_id` must store the assigned staff member.
   - Schedule board should prefer `appointments.staff_id` over local staff assignment state.
   - Drag/drop staff reassignment and resize should PATCH the appointment, not only update local UI.
   - Status: strengthened for schedule-board drag/drop staff change and duration resize.

3. Notification history
   - Customer detail should show recent notification statuses.
   - Owner should be able to see sent/failed/skipped with failure reason and resend affordance.

4. Automatic notification scheduler
   - Verify the cron route is configured in Vercel.
   - Confirm queued future notifications are picked up and sent, not only inserted.
   - Add an admin/owner audit showing last scheduler run and processed count.
   - Status: Vercel cron config now calls `/api/notifications/schedule` every 5 minutes.

5. Staff availability
   - Staff weekly/default schedules should influence available assignment windows.
   - Booking availability currently protects shop capacity/time, but staff-level availability needs final enforcement.
   - Status: owner-created bookings and schedule-board adjustments now check staff default days, selected-date overrides, half-day/off/annual states, and work hours.

6. Deletion/restore consistency
   - Soft-deleted guardians should disappear from owner surfaces.
   - Restore should bring back linked pets/appointments/records visibility correctly.

7. Media and notification attachments
   - Uploaded grooming/customer images must remain linked to appointment, pet, guardian, notification, and record where applicable.
   - Expiry/cleanup should not remove media still needed for owner records.

## Data Ownership Rules

- `guardians` is the customer profile root.
- `pets` belongs to one guardian and one shop.
- `appointments` is the source of truth for schedule/calendar reservation state.
- `appointments.staff_id` is the source of truth for assigned staff when present.
- `grooming_records` is the source of truth for completed service history.
- `notifications` is the source of truth for all customer/owner message attempts.
- `media_assets` and `notification_media_attachments` are the source of truth for sent/shared media.

## Work Structure

Use this order when tightening the product. It keeps data integrity work ahead of visual polish.

1. Booking and schedule integrity
   - Owner/customer booking writes one `appointments` row.
   - `appointments.appointment_time`, `start_at`, `end_at`, `status`, and `staff_id` must be updated together.
   - Schedule board and calendar must render from the same appointment data.
   - Same-staff overlapping appointments are never allowed.

2. Customer profile integrity
   - `guardians` owns customer name, phone, memo, and notification preference.
   - `pets` owns pet name/breed/birthday/cycle.
   - Customer detail edits must write to the owning table, not only local UI state.
   - Current baseline persists guardian edits, notification preference, existing pet edits, newly added pets, and new owner-created customers. Pet deletion is allowed only when no operational data is linked.

3. Operational status flow
   - Confirmation, rejection, cancellation, in-progress, pickup-ready, and completion must update `appointments.status`.
   - Completion must create or update the linked `grooming_records` row.
   - Status changes should be visible in schedule, calendar, customer detail, and records.
   - Current baseline persists schedule-board status actions through `/api/appointments`, keeps edited schedule data from being reset to stale bootstrap data, and refreshes the selected date range after completion so new grooming records appear in connected owner screens.

4. Notification flow
   - Every attempted message must create a `notifications` row.
   - Sent/failed/skipped/queued status and provider failure reason must stay visible for audit.
   - Scheduled notifications require a verified production trigger and last-run visibility.
   - Current baseline surfaces recent customer-level notification history in owner web customer detail, including sent/queued/failed/skipped state and failure or skip reason.
   - Schedule status actions refresh recent notifications after server dispatch so customer detail can show newly created booking/grooming messages without waiting for a full page reload.
   - Current baseline registers Vercel cron for `/api/notifications/schedule` every 5 minutes and records each run in `notification_scheduler_runs` with success/failure, processed counts, duration, trigger source, and error message.

5. Staff availability flow
   - Staff default schedule and selected-day overrides should constrain staff assignment.
   - Customer-facing availability may use shop capacity, but owner schedule must also respect staff-level working windows.
   - Current baseline enforces staff default days, selected-date overrides, half-day/off/annual states, and start/end hours. Leave request approval still needs a dedicated persistent workflow.

6. Media flow
   - Grooming and message images must stay linked to appointment, guardian, pet, record, and notification attachment when applicable.
   - Retention cleanup must not remove media needed for records or sent-message audit.
   - Current baseline lists grooming photos by both appointment and grooming-record context when both IDs are known, so photos captured during a reservation remain visible after the reservation becomes a completed record.
   - Completion backfills `media_assets.grooming_record_id` for photos already linked to the completed appointment. This backfill should never block appointment completion; failures are logged for follow-up.
   - Owner schedule work flow should capture one start photo before `in_progress` and one finish photo before `almost_done`; those images are passed as `mediaAssetIds` to the matching grooming notification so the customer receives the operational photo at the right moment.
