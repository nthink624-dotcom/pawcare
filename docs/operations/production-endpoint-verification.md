# Production endpoint verification

Run this read-only smoke check after each web and mobile production deployment:

```powershell
npm run check:production-endpoints
```

When both Vercel projects must be on the same release, pass the exact commit
identifier as an additional read-only assertion:

```powershell
npm run check:production-endpoints -- --expected-release <commit-sha>
```

The check requires both production domains to expose `/api/healthz` with HTTP
200 and `/api/readyz` with HTTP 200. It also verifies that the JSON `requestId`
matches the `x-request-id` response header and that both JSON responses expose a
release identifier. It never prints response bodies or credentials. Use
`--report-only` when documenting a known pre-deployment state;
that mode reports failures without changing the exit code.

The current production readback is intentionally not marked ready: both
domains return 404 for these routes because the local route files are not yet
in a committed and deployed release.

## Local runtime contract readback

After the local production builds, the web and mobile previews were started on
isolated task ports and checked without modifying data:

- Web `/api/healthz` and `/api/readyz` both returned HTTP 200 with request
  correlation IDs and a ready Supabase probe.
- Mobile `/api/healthz` and `/api/readyz` both returned HTTP 200 with request
  correlation IDs and a ready Supabase probe.
- The task-owned preview processes were stopped and their ports were verified
  closed afterward. The `start:local` wrapper must be used so development
  loopback relay placeholders are normalized before server environment loading.
