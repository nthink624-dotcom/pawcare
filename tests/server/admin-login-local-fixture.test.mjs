import assert from "node:assert/strict";
import { randomUUID, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve, sep } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const fixtureUrl = new URL("../fixtures/admin-login-local.json", import.meta.url);
const fixturePath = fileURLToPath(fixtureUrl);
const fixtureRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");
const fixture = JSON.parse(readFileSync(fixtureUrl, "utf8"));

function passwordHash(password) {
  const salt = "local-fixture-salt";
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

test("local fixture verifies one admin login without remote or write access", async (t) => {
  assert.equal(fixture.testOnly, true);
  assert.ok(fixturePath.startsWith(`${fixtureRoot}${sep}`));

  const requests = [];
  const accountId = randomUUID();
  const server = createServer((request, response) => {
    requests.push({ method: request.method, url: request.url });
    assert.equal(request.method, "GET");
    assert.match(request.url ?? "", /^\/rest\/v1\/admin_accounts\?/);
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({
      id: accountId,
      full_name: fixture.fullName,
      email: "local-fixture@example.invalid",
      phone_number: null,
      login_id: fixture.loginId,
      password_hash: passwordHash(fixture.password),
      is_super_admin: true,
      is_active: true,
      created_at: "2026-08-28T00:00:00.000Z",
      updated_at: "2026-08-28T00:00:00.000Z"
    }));
  });

  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  t.after(() => new Promise((resolveClose) => server.close(resolveClose)));
  const address = server.address();
  assert.equal(address.address, "127.0.0.1");

  process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
  process.env.SUPABASE_SERVICE_ROLE_KEY = "local-fixture-service-role";
  process.env.SUPABASE_ENV_NAME = "development";
  process.env.ADMIN_SESSION_SECRET = "local-fixture-session-secret";
  delete process.env.ALLOW_PROD_SUPABASE_IN_DEV;
  delete process.env.VERCEL_ENV;

  const [{ NextRequest }, { POST }] = await Promise.all([
    import("next/server"),
    import("../../src/app/api/admin/auth/login/route.ts"),
  ]);
  const response = await POST(new NextRequest("http://127.0.0.1/api/admin/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ loginId: fixture.loginId, password: fixture.password }),
  }));

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.equal(body.account.id, accountId);
  assert.match(response.headers.get("set-cookie") ?? "", /^petmanager_admin_session=/);
  assert.equal(requests.length, 1);
  assert.deepEqual(new Set(requests.map(({ method }) => method)), new Set(["GET"]));
});
