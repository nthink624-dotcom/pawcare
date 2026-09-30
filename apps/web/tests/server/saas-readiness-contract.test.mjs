import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");

test("health endpoint is a no-store liveness check without database access", async () => {
  const route = await read("src/app/api/healthz/route.ts");
  const observability = await read("src/lib/observability.ts");

  assert.match(route, /export async function GET/);
  assert.match(route, /getRequestId/);
  assert.match(route, /getReleaseId/);
  assert.match(route, /x-request-id/);
  assert.match(route, /requestId/);
  assert.match(route, /release/);
  assert.match(route, /status: "ok"/);
  assert.match(route, /Cache-Control/);
  assert.doesNotMatch(route, /getSupabase|from\("/);
  assert.match(observability, /VERCEL_ENV === "production"/);
  assert.match(observability, /"unknown"/);
});

test("readiness endpoint checks Supabase without exposing errors or data", async () => {
  const route = await read("src/app/api/readyz/route.ts");

  assert.match(route, /getSupabaseAdmin/);
  assert.match(route, /await import\("@\/lib\/supabase\/server"\)/);
  assert.doesNotMatch(route, /import \{ getSupabaseAdmin \} from/);
  assert.match(route, /getRequestId/);
  assert.match(route, /getReleaseId/);
  assert.match(route, /x-request-id/);
  assert.match(route, /requestId/);
  assert.match(route, /release/);
  assert.match(route, /from\("shops"\)\.select\("id"\)\.limit\(1\)/);
  assert.match(route, /status: ready \? 200 : 503/);
  assert.match(route, /Cache-Control/);
  assert.match(route, /readiness\.supabase_query_failed/);
  assert.match(route, /AbortController/);
  assert.match(route, /abortSignal\(controller\.signal\)/);
  assert.match(route, /setTimeout\(\(\) => controller\.abort\(\), 2_000\)/);
  assert.doesNotMatch(route, /result\.error\.message/);
  assert.doesNotMatch(route, /result\.data/);
});

test("local predeploy keeps loopback relay placeholders HTTPS-only during builds", async () => {
  const buildScript = await read("scripts/run-next-build-with-preview-lock.cjs");

  assert.match(buildScript, /ALIMTALK_RELAY_URL/);
  assert.match(buildScript, /parsed\.protocol === "http:"/);
  assert.match(buildScript, /parsed\.protocol = "https:"/);
  assert.match(buildScript, /LOOPBACK_HOSTNAMES/);
});

test("production launch rechecks protected Alimtalk environment readback", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");

  assert.match(launchGate, /check-alimtalk-template-env-consistency\.cjs/);
  assert.match(launchGate, /--pull-vercel-production/);
  assert.match(launchGate, /const webRoot = path\.join\(root, "apps\/web"\)/);
  assert.match(launchGate, /cwd: webRoot/);
  assert.match(launchGate, /production Alimtalk relay\/template environment readback did not pass/);
  assert.match(launchGate, /check-payment-env-vercel\.cjs/);
  assert.match(launchGate, /production PortOne payment environment readback did not pass/);
});

test("production launch blocks policyless Supabase browser exposure", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");

  assert.match(launchGate, /publicTableRlsReadback/);
  assert.match(launchGate, /tablesWithoutRls/);
  assert.match(launchGate, /tablesWithoutPolicies/);
  assert.match(launchGate, /browserTableGrantRows/);
  assert.match(launchGate, /public table grant rows/);
});

test("production launch blocks when database or media recovery is unverified", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");

  assert.match(launchGate, /dailyBackupsEnabled/);
  assert.match(launchGate, /pitrEnabled/);
  assert.match(launchGate, /encryptedOffsiteBackupEnabled/);
  assert.match(launchGate, /database restore drill is not verified/);
  assert.match(launchGate, /production media object retention\/recovery configuration is not verified/);
  assert.match(launchGate, /production media restore drill is not verified/);
  assert.match(readbackCheck, /saas-recovery-readback-20261001\.json/);
});

test("production launch blocks until the live development tenant-isolation fixture passes cleanly", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");

  assert.match(launchGate, /tenant-isolation-readback-20261001\.json/);
  assert.match(launchGate, /development cross-tenant isolation fixture has not passed with zero cleanup residue/);
  assert.match(readbackCheck, /tenant-isolation readback evidence must include an ISO calendar readAt date/);
  assert.match(readbackCheck, /passing tenant-isolation fixture must confirm zero cleanup residue/);
});

test("production launch uses the latest read-only browser-grant result for production", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");

  assert.match(launchGate, /supabase-browser-grants-readback-20261001\.json/);
  assert.match(launchGate, /latest production Supabase browser table-grant readback is not clean/);
  assert.match(readbackCheck, /\$\{target\} Supabase browser grant readback is missing, mismatched, or not clean/);
});

test("post-deploy verification requires an explicit release and reuses the launch gate", async () => {
  const rootPackage = await read("../../package.json");
  const postdeploy = await read("../../scripts/check-postdeploy-release.cjs");
  const launchDocs = await read("../../docs/operations/production-launch-gate.md");

  assert.match(rootPackage, /"postdeploy:release"/);
  assert.match(postdeploy, /--expected-release/);
  assert.match(postdeploy, /check-production-launch-readiness\.cjs/);
  assert.match(postdeploy, /check-readback-evidence\.cjs/);
  assert.match(launchDocs, /npm run postdeploy:release/);
});
