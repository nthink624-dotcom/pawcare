import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("operational logging allowlists bounded non-sensitive context", async () => {
  const source = await read("src/lib/observability.ts");

  assert.match(source, /SAFE_CONTEXT_KEYS/);
  assert.match(source, /requestId/);
  assert.match(source, /REQUEST_ID_PATTERN/);
  assert.match(source, /crypto\.randomUUID/);
  assert.match(source, /route/);
  assert.match(source, /durationMs/);
  assert.match(source, /slice\(0, 120\)/);
  assert.match(source, /JSON\.stringify/);
  assert.doesNotMatch(source, /authorization|accessToken|refreshToken|currentPassword|phone|email/i);
});

test("critical billing and notification failures use the redacted event boundary", async () => {
  const sources = await Promise.all([
    read("src/server/owner-billing.ts"),
    read("../../apps/mobile/src/server/owner-billing.ts"),
    read("src/server/notification-dispatch.ts"),
    read("src/server/alimtalk-provider.ts"),
    read("src/lib/customer-booking-notification.ts"),
    read("src/app/api/customer-booking-access-link/route.ts"),
    read("src/server/owner-mutations.ts"),
    read("src/app/api/auth/login/route.ts"),
    read("src/app/api/auth/resend-email-confirmation/route.ts"),
    read("src/server/owner-login-sessions.ts"),
    read("src/server/admin-support-email.ts"),
    read("src/server/owner-support-requests.ts"),
    read("src/server/owner-default-setup.ts"),
    read("src/server/marketing-kpi-snapshot.ts"),
    read("src/app/api/auth/storage-health/route.ts"),
    read("src/app/api/auth/signup/route.ts"),
    read("src/app/api/webhooks/portone/route.ts"),
    read("src/app/api/dev/create-owner/route.ts"),
    read("../../apps/mobile/src/server/alimtalk-provider.ts"),
    read("../../apps/mobile/src/server/customer-bookings.ts"),
    read("../../apps/mobile/src/server/owner-mutations.ts"),
    read("../../apps/mobile/src/server/owner-push-delivery.ts"),
  ]);

  for (const source of sources) {
    assert.match(source, /logOperationalEvent/);
    assert.doesNotMatch(source, /console\.(?:error|warn)\(/);
  }

  assert.doesNotMatch(sources[6], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[7], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[8], /console\.(?:log|info|warn|error)\(|error\.message/);
  assert.doesNotMatch(sources[9], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[10], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[11], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[12], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[13], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[14], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[15], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[16], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[17], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[19], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[20], /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(sources[21], /console\.(?:log|info|warn|error)\(/);
});

test("the global UI error boundary does not log error payloads", async () => {
  const source = await read("src/app/error.tsx");

  assert.match(source, /logOperationalEvent\("ui\.route_error_recovered"/);
  assert.doesNotMatch(source, /console\.(?:log|info|warn|error)\(/);
  assert.doesNotMatch(source, /error\.message|error\.digest/);
});
