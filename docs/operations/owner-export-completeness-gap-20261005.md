# Owner export completeness gap

## Observed source

`apps/web/src/app/api/owner/data-export/route.ts` reads each shop table with a single select filtered by shop_id and ordered by created_at. It does not paginate, request an exact count or detect a provider row cap. A successful response therefore does not prove every requested row was exported.

The deletion route has a similar completeness dependency when enumerating media_assets and media_variants before removing storage objects. Do not execute an account deletion to test this against production.

## Required fix and verification

Implement bounded, deterministic pagination (created_at plus unique id ordering), preserve shop scope and explicit column allowlists on every query, and reject incomplete/error responses rather than returning silent partial exports. Test more than the provider page limit, tied timestamps, empty/final pages, mid-page errors, maximum export size and cross-tenant filters. Concurrent writes require an explicit consistency boundary; offset paging alone does not establish a point-in-time snapshot.

For destructive deletion, independently verify complete enumeration and residue detection before finalization, including multi-page assets and variants. This is privacy/data-loss-sensitive work and needs independent QA according to the project instructions; do not broaden into unauthorized production deletion or silently assign another agent.

No export, deletion, customer-row query or runtime source change was performed during this review. Existing static contract passes do not establish completeness for large shops.

## Local reproduction

### Local fix status

The export and deletion media enumeration now use exact-count pagination, unique ordering and bounded variant asset-ID chunks. Helper/export focused tests passed 10/10 and deletion focused contracts passed 6/6. Enumeration failures stop before deletion storage operations. The historical reproduction script recognizes the new helper and reports SUPERSEDED instead of testing an obsolete query. Independent synthetic route QA is in progress; no production deployment/deletion/export was performed. Concurrent same-count edits are not guaranteed to form a transaction snapshot.

Independent QA subsequently reported 19 synthetic route checks passing on the final source: all six export tables with 1,003 rows under caps 17/137/500; deletion with 1,003 assets and 2,006 variants under caps 17/137; owner-shop and asset-ID scopes; bounded IN chunks and storage batches; query failures/count drift/duplicates/premature empty/missing count fail before destructive operations; storage exceptions/residue stop later deletion steps. Full web TypeScript check passed with incremental output disabled. This closes the reproduced provider-cap truncation gap locally, not the entire SaaS launch gate. Live provider/account behavior, deployment and concurrent-write snapshot guarantees remain unverified.

Executed `node scripts/diagnose-owner-export-row-cap.cjs`. The diagnostic extracts the current readShopRows body and executes it against a tenant-checked mock query with 1,001 generated rows and a simulated 1,000-row response cap. The helper returned 1,000 without any incomplete-result error. This proves the source's behavior under that cap, not the currently configured Production cap. No network or customer data used. The diagnostic reports REPRODUCED and is intentionally not a readiness/completeness PASS. The route's existing dirty changes were preserved.
