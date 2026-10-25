# Template-request migration source reconciliation

## Scope and evidence

- Production project: `ysxykikqnneuhypybjry`.
- Read-only catalog query performed on 2026-10-05. No application/customer rows read and no remote writes performed.
- Canonical recovered source: `supabase/migrations/20261003095820_shop_alimtalk_template_requests.sql`.
- Historical source location: `C:/Users/happy/orca/workspaces/petmanager/gardeneel/supabase/migrations/20261003095820_shop_alimtalk_template_requests.sql`. Historical file was untracked and left untouched. Text equality was verified after newline normalization.

## Comparison result

Production catalog matches the recovered migration's intended structure:

- All 15 columns match types, nullability and defaults.
- Primary key, unique template code, both foreign keys and deletion actions match.
- Notification-type and inspection-status CHECK value sets match.
- Shop/type/date index and partial unique active-review index match.
- Row-level security is enabled. Table ACL grants only postgres and service_role; anon and authenticated have no table grants.

This establishes current structural correspondence, not byte-for-byte proof of the originally applied migration SQL or an end-to-end API authorization test. Do not replay the existing Production migration.

## Remaining release conditions

- Fresh full history readback saved in `migration-history-comparison-20261005.json`: both projects still have 168 migrations. Production-only and Development-only version sets remain two entries each.
- Newly identified same-version/name disagreement: `202606060001` is `staff_profile_image_url` in Production and `appointment_notification_timing` in Development. Version-set equality alone does not prove semantic parity. Compare applied migration statements or affected schema before treating this as a benign alias; no history repair is authorized by this metadata result.

- Reconcile the known push-token ACL version alias using its previously verified equal Git blob, preserving both remote histories.
- Refresh full Development/Production migration-set readback before planning any migration application.
- Review missing operational-error inbox, 60-day retention and notification-dispatch claim migrations. Remote DB writes remain separately approval-gated.
- The recovered migration is not committed yet; source recovery alone does not establish a clean, deployable release.
