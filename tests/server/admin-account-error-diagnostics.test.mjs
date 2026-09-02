import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  classifyAdminAccountInfraError,
  toAdminAccountInfraError,
} from "../../src/server/admin-account.ts";

const adminLoginRoute = readFileSync(
  new URL("../../src/app/api/admin/auth/login/route.ts", import.meta.url),
  "utf8",
);

test("admin account infrastructure errors use stable coarse categories", () => {
  assert.equal(classifyAdminAccountInfraError({ code: "42P01" }), "schema_missing");
  assert.equal(classifyAdminAccountInfraError({ code: "PGRST205" }), "schema_missing");
  assert.equal(classifyAdminAccountInfraError({ code: "42501" }), "permission_denied");
  assert.equal(classifyAdminAccountInfraError({ message: "permission denied for table admin_accounts" }), "permission_denied");
  assert.equal(classifyAdminAccountInfraError({ code: "PGRST301" }), "auth_key");
  assert.equal(classifyAdminAccountInfraError({ code: "401" }), "auth_key");
  assert.equal(classifyAdminAccountInfraError({ message: "TypeError: fetch failed" }), "network");
  assert.equal(classifyAdminAccountInfraError({ code: "ENETUNREACH" }), "network");
  assert.equal(classifyAdminAccountInfraError({ code: "XX000", message: "unexpected failure" }), "unknown");
});

test("admin account diagnostics log only safe structured fields once", () => {
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);

  try {
    const error = toAdminAccountInfraError(
      {
        code: "42501",
        message: "permission denied for user owner@example.com using secret-key-value",
        details: "query: select * from admin_accounts where login_id = 'private-owner'",
        hint: "use key another-secret-value",
      },
      "find_by_login_id",
    );

    assert.equal(error.status, 503);
    assert.equal(error.message, "관리자 데이터 연결을 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], [
    '{"workId":"ADMIN_HOME_REFERENCE_20260830","operation":"find_by_login_id","category":"permission_denied","code":"42501"}',
  ]);

  const logged = JSON.stringify(calls);
  assert.doesNotMatch(logged, /owner@example\.com|secret-key-value|another-secret-value|private-owner|select \*/);
  assert.doesNotMatch(logged, /message|details|hint|query|loginId|password|key/i);
});

test("admin account diagnostics replace an unsafe error code without leaking it", () => {
  const originalConsoleError = console.error;
  const calls = [];
  console.error = (...args) => calls.push(args);

  try {
    toAdminAccountInfraError(
      {
        code: "42501\nsecret-key-value",
        message: "permission denied for owner@example.com",
      },
      "check_any_account",
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls, [
    [
      '{"workId":"ADMIN_HOME_REFERENCE_20260830","operation":"check_any_account","category":"permission_denied","code":"NO_SAFE_CODE"}',
    ],
  ]);
  assert.doesNotMatch(JSON.stringify(calls), /owner@example\.com|secret-key-value|42501\\n/);
});

test("admin account diagnostics preserve the existing missing-schema response", () => {
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const error = toAdminAccountInfraError({ code: "42P01" }, "find_by_login_id");
    assert.equal(error.status, 503);
    assert.equal(error.message, "관리자 계정 저장소가 아직 준비되지 않았습니다. 잠시 후 다시 시도해 주세요.");
  } finally {
    console.error = originalConsoleError;
  }
});

test("an expected missing or inactive admin account remains a 401 login result", () => {
  assert.match(adminLoginRoute, /if \(!account \|\| !account\.is_active \|\| !verifyAdminPassword/);
  assert.match(adminLoginRoute, /관리자 아이디 또는 비밀번호를 다시 확인해 주세요\." \}, \{ status: 401 \}/);
});
