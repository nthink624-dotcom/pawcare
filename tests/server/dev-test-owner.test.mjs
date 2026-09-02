import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DEVELOPMENT_TEST_OWNER_PROJECT_REF,
  DevelopmentTestOwnerError,
  assertDevelopmentTestOwnerTarget,
  getDevelopmentTestOwnerMissingParts,
  isRecoverableDevelopmentTestOwnerSignInError,
  validateDevelopmentTestOwnerPassword,
} from "../../src/server/dev-test-owner.ts";

const developmentUrl = `https://${DEVELOPMENT_TEST_OWNER_PROJECT_REF}.supabase.co`;

test("test owner is allowed only on localhost or preview with the exact validation project", () => {
  assert.doesNotThrow(() =>
    assertDevelopmentTestOwnerTarget({
      hostname: "127.0.0.1",
      runtimeStage: "development",
      supabaseUrl: developmentUrl,
      allowedDevSupabaseRefs: DEVELOPMENT_TEST_OWNER_PROJECT_REF,
    }),
  );
  assert.doesNotThrow(() =>
    assertDevelopmentTestOwnerTarget({
      hostname: "preview.example.test",
      runtimeStage: "preview",
      supabaseUrl: developmentUrl,
      allowedDevSupabaseRefs: DEVELOPMENT_TEST_OWNER_PROJECT_REF,
    }),
  );
});

test("test owner fails closed for production, an external local host, or another project", () => {
  for (const target of [
    {
      hostname: "petmanager.example.com",
      runtimeStage: "production",
      supabaseUrl: developmentUrl,
      allowedDevSupabaseRefs: DEVELOPMENT_TEST_OWNER_PROJECT_REF,
    },
    {
      hostname: "example.test",
      runtimeStage: "development",
      supabaseUrl: developmentUrl,
      allowedDevSupabaseRefs: DEVELOPMENT_TEST_OWNER_PROJECT_REF,
    },
    {
      hostname: "127.0.0.1",
      runtimeStage: "development",
      supabaseUrl: "https://ysxykikqnneuhypybjry.supabase.co",
      allowedDevSupabaseRefs: DEVELOPMENT_TEST_OWNER_PROJECT_REF,
    },
  ]) {
    assert.throws(
      () => assertDevelopmentTestOwnerTarget(target),
      (error) => error instanceof DevelopmentTestOwnerError,
    );
  }
});

test("test owner password must be long and contain four character classes", () => {
  assert.equal(validateDevelopmentTestOwnerPassword("test1234"), false);
  assert.equal(validateDevelopmentTestOwnerPassword("only-lowercase-password-123"), false);
  assert.equal(validateDevelopmentTestOwnerPassword("Safe-Validation-Owner-42!"), true);
});

test("complete test owner data produces no missing setup writes", () => {
  const snapshot = {
    user: { email_confirmed_at: "2026-08-30T00:00:00.000Z" },
    profile: { user_id: "user", shop_id: "shop", login_id: "dev@example.test" },
    shop: { id: "shop", owner_user_id: "user" },
    subscriptionExists: true,
    membershipExists: true,
    ownerStaffExists: true,
    existingServiceNames: new Set([
      "전체 미용",
      "목욕 + 부분정리",
      "목욕",
      "위생 미용",
      "부분 미용",
      "스파/약욕 케어",
      "발톱 정리",
    ]),
    notificationCreditsExist: true,
  };

  assert.deepEqual(getDevelopmentTestOwnerMissingParts(snapshot), []);
});

test("only absent owner links are reported for repair", () => {
  const snapshot = {
    user: { email_confirmed_at: null },
    profile: { user_id: "user", shop_id: "shop", login_id: "dev@example.test" },
    shop: { id: "shop", owner_user_id: "user" },
    subscriptionExists: true,
    membershipExists: false,
    ownerStaffExists: false,
    existingServiceNames: new Set(),
    notificationCreditsExist: false,
  };

  assert.deepEqual(getDevelopmentTestOwnerMissingParts(snapshot), [
    "email_confirmation",
    "owner_membership",
    "owner_staff",
    "default_services",
    "notification_credits",
  ]);
});

test("credential recovery is limited to invalid credentials and unconfirmed email", () => {
  assert.equal(isRecoverableDevelopmentTestOwnerSignInError({ code: "invalid_credentials" }), true);
  assert.equal(isRecoverableDevelopmentTestOwnerSignInError({ code: "email_not_confirmed" }), true);
  assert.equal(isRecoverableDevelopmentTestOwnerSignInError({ code: "over_request_rate_limit" }), false);
  assert.equal(isRecoverableDevelopmentTestOwnerSignInError({ message: "fetch failed" }), false);
});

test("implementation never reseeds, deletes, or returns test-owner credentials", async () => {
  const [serverSource, routeSource, loginSource, smokeSource] = await Promise.all([
    readFile(new URL("../../src/server/dev-test-owner.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/app/api/dev/create-owner/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/auth/login-form.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../scripts/smoke-owner-login.cjs", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(serverSource, /seedDemoDataForShop|\.delete\s*\(/);
  assert.doesNotMatch(routeSource, /\bemail\s*:|\bpassword\s*:/);
  assert.doesNotMatch(loginSource, /result\.password|setPassword\(result\.password\)/);
  assert.doesNotMatch(smokeSource, /test1234|DEFAULT_PASSWORD/);
});
