# Tenant isolation verification

PetManager uses `shop_id` as the tenant boundary. Owner API routes must resolve the current user's shop membership before reading or mutating owner data, and database relations that can cross a shop boundary must reject mismatched rows.

## Repository gates

- `npm run check:owner-tenant-guards` scans every `apps/web/src/app/api/owner/**/route.ts` for the owner shop/manager guard. Account deletion is a deliberate server-only exception with its own reauthentication and guarded claim.
- `npm run check:tenant-isolation` verifies that the cross-shop database integrity contracts and temporary development fixtures remain present.
- `npm run test:reliability --workspace=@petmanager/web` includes the booking/payment tenant-integrity and fixture contract tests.

## Development fixture

The acquisition and tester-feedback fixtures create uniquely marked rows in the development project, attempt a foreign-tenant operation, assert that it is denied, and remove the rows in reverse dependency order. They must be run only with the exact development project ref and one-time protected credentials. They never target production and must finish with a zero-residue check.

The fixture definitions are not proof that a run occurred. Before launch, execute the approved fixture against the development project, retain only the aggregate pass/fail result, and record the run date and project ref in `tenant-isolation-readback-20261001.json`. The production launch gate requires a passing result and zero residue. Do not copy customer data into a test fixture.

## Failure response

If a fixture permits a foreign-tenant operation or leaves residue, stop release work, revoke the temporary credentials, inspect the failing migration/API boundary, and rerun the fixture after the repair. Do not weaken the test to make the gate pass.
