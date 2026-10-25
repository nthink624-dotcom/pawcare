# Notification timing history reconciliation

Read-only Supabase migration metadata and schema catalogs checked on 2026-10-05. No application rows read, no migration replay, no history repair and no database write.

## Historical SQL differs

| Version | Production | Development |
| --- | --- | --- |
| 202606060001 | staff_profile_image_url; 1 statement; MD5 51d138ac390c795b7a86a2ab1c631a62 | appointment_notification_timing; 3 statements; MD5 a9ef0cd58bcec655b231d3310d306daf |
| 202606070003 | staff_profile_image_url; MD5 51d138ac390c795b7a86a2ab1c631a62 | same |
| 202606070004 | appointment_notification_timing_backfill; 3 statements; MD5 17f482697c8719770e68932825313e1a | same |

Digest computed on the server with `md5(array_to_string(statements, E'\n'))`. It is a comparison aid, not a security signature.

The 202606060001 difference is not merely a naming alias. Both databases subsequently applied the same notification-timing backfill migration. Both current databases have validated constraints for pickup_ready_eta_minutes and visit_reminder_offset_minutes, each bounded from 0 to 180. This explains convergence without rewriting historical SQL.

Do not add this version to the content-identical push-token ACL alias list. Preserve the historical record and use explicit schema correspondence checks when assessing release readiness. The recovered AlimTalk migration and absent operations migrations remain separate reconciliation items.
