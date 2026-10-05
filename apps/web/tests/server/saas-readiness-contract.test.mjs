import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  isAllowedPetManagerDevelopmentSupabaseProject,
  isPetManagerProductionSupabaseProject,
} from "../../../shared/contracts/supabase-environment.ts";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const require = createRequire(import.meta.url);
const ignore = require("ignore");
const { MAX_RPO_MINUTES, MAX_RTO_MINUTES, validateRestoreDrill } = require("../../../../scripts/lib/recovery-objectives.cjs");
const { validateLaunchReadbackConsistency } = require("../../../../scripts/lib/launch-readback-consistency.cjs");
const { checkRestTable } = require("../../scripts/check-media-schema-rest.cjs");
const { contractFailureReason, runProductionEndpointChecks } = require("../../../../scripts/check-production-endpoints.cjs");

test("production Supabase connections require the exact production project and environment label", async () => {
  assert.equal(
    isPetManagerProductionSupabaseProject("production", "https://ysxykikqnneuhypybjry.supabase.co"),
    true,
  );
  assert.equal(
    isPetManagerProductionSupabaseProject("production", "https://qefxdtmdtvnzgupmjlom.supabase.co"),
    false,
  );
  assert.equal(
    isPetManagerProductionSupabaseProject("development", "https://ysxykikqnneuhypybjry.supabase.co"),
    false,
  );
  assert.equal(isPetManagerProductionSupabaseProject("production", undefined), false);
  assert.equal(
    isPetManagerProductionSupabaseProject("production", "http://ysxykikqnneuhypybjry.supabase.co"),
    false,
  );

  const [webServer, webBrowser, mobileServer, mobileBrowser] = await Promise.all([
    read("src/lib/server-env.ts"),
    read("src/lib/env.ts"),
    read("../mobile/src/lib/server-env.ts"),
    read("../mobile/src/lib/env.ts"),
  ]);
  for (const source of [webServer, webBrowser, mobileServer, mobileBrowser]) {
    assert.match(source, /isPetManagerProductionSupabaseProject/);
    assert.match(source, /runtimeStage === "production"/);
  }
});

test("development Supabase allowlists accept only approved HTTPS project origins and never production", () => {
  assert.equal(
    isAllowedPetManagerDevelopmentSupabaseProject(
      "https://qefxdtmdtvnzgupmjlom.supabase.co",
      "qefxdtmdtvnzgupmjlom",
    ),
    true,
  );
  assert.equal(
    isAllowedPetManagerDevelopmentSupabaseProject(
      "https://ysxykikqnneuhypybjry.supabase.co",
      "ysxykikqnneuhypybjry",
    ),
    false,
  );
  assert.equal(
    isAllowedPetManagerDevelopmentSupabaseProject(
      "https://other.supabase.co",
      "qefxdtmdtvnzgupmjlom",
    ),
    false,
  );

  for (const url of [
    "http://qefxdtmdtvnzgupmjlom.supabase.co",
    "https://qefxdtmdtvnzgupmjlom.supabase.co:8443",
    "https://user@qefxdtmdtvnzgupmjlom.supabase.co",
    "https://qefxdtmdtvnzgupmjlom.supabase.co/rest/v1",
    "https://qefxdtmdtvnzgupmjlom.supabase.co/?query=1",
    "https://qefxdtmdtvnzgupmjlom.supabase.co/#fragment",
  ]) {
    assert.equal(
      isAllowedPetManagerDevelopmentSupabaseProject(url, "qefxdtmdtvnzgupmjlom"),
      false,
      `${url} must not be accepted as a project origin`,
    );
  }
});

test("automatic production endpoint check avoids the database-backed readiness route", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    const requestId = `request-${requests.length}`;
    return {
      status: 200,
      headers: new Headers({ "x-request-id": requestId }),
      text: async () => JSON.stringify({ status: "ok", requestId, release: "a".repeat(40) }),
    };
  };

  const result = await runProductionEndpointChecks({
    targets: [
      { name: "web", baseUrl: "https://web.example.invalid" },
      { name: "mobile", baseUrl: "https://mobile.example.invalid" },
    ],
    fetchImpl,
  });

  assert.equal(result.status, "PASS");
  assert.equal(result.includeReadiness, false);
  assert.deepEqual(requests, [
    "https://web.example.invalid/api/healthz",
    "https://mobile.example.invalid/api/healthz",
  ]);
  assert.ok(result.results.every(({ readiness }) => readiness.contract === "NOT_REQUESTED"));
});

test("production endpoint failure reports a safe reason without exposing response values", async () => {
  const fetchImpl = async () => ({
    status: 200,
    headers: new Headers({ "x-request-id": "request-1" }),
    text: async () => JSON.stringify({ status: "ok", requestId: "request-1", release: "unknown" }),
  });

  const result = await runProductionEndpointChecks({
    targets: [{ name: "web", baseUrl: "https://web.example.invalid" }],
    fetchImpl,
  });

  assert.equal(result.status, "FAIL");
  assert.equal(result.results[0].health.failureReason, "RELEASE_UNKNOWN");
  assert.doesNotMatch(JSON.stringify(result), /unknown/);
  assert.equal(contractFailureReason({ status: null, error: "AbortError" }, 200), "REQUEST_FAILED");
});

test("routine predeploy avoids production endpoint probes while launch verification opts into readiness", async () => {
  const predeploy = await read("../../scripts/check-predeploy-release.cjs");
  const rootPackage = JSON.parse(await read("../../package.json"));
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");

  assert.doesNotMatch(predeploy, /"check:production-endpoints"/);
  assert.equal(rootPackage.scripts["check:production-endpoints"], "node scripts/check-production-endpoints.cjs");
  assert.doesNotMatch(rootPackage.scripts["check:production-endpoints"], /--include-readiness/);
  assert.match(launchGate, /check-production-endpoints\.cjs"\), "--include-readiness"/);
});

test("database-backed readiness is opt-in and skipped when release identity fails", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    const requestId = `request-${requests.length}`;
    return {
      status: 200,
      headers: new Headers({ "x-request-id": requestId }),
      text: async () => JSON.stringify({ status: "ok", requestId, release: "unknown" }),
    };
  };

  const result = await runProductionEndpointChecks({
    targets: [{ name: "web", baseUrl: "https://web.example.invalid" }],
    expectedRelease: "a".repeat(40),
    includeReadiness: true,
    fetchImpl,
  });

  assert.equal(result.status, "FAIL");
  assert.equal(result.results[0].health.failureReason, "RELEASE_UNKNOWN");
  assert.deepEqual(requests, ["https://web.example.invalid/api/healthz"]);
  assert.equal(result.results[0].readiness.contract, "SKIPPED_HEALTH_GATE");
});

test("explicit production launch readiness checks the database only after a valid release identity", async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    const requestId = `request-${requests.length}`;
    return {
      status: 200,
      headers: new Headers({ "x-request-id": requestId }),
      text: async () => JSON.stringify({ status: "ok", requestId, release: "b".repeat(40) }),
    };
  };

  const result = await runProductionEndpointChecks({
    targets: [{ name: "web", baseUrl: "https://web.example.invalid" }],
    expectedRelease: "b".repeat(40),
    includeReadiness: true,
    fetchImpl,
  });

  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  assert.equal(result.status, "PASS");
  assert.deepEqual(requests, [
    "https://web.example.invalid/api/healthz",
    "https://web.example.invalid/api/readyz",
  ]);
  assert.match(launchGate, /check-production-endpoints\.cjs"\), "--include-readiness", "--expected-release"/);
});

test("manual development media schema probe uses HEAD and never consumes table response bodies", async () => {
  const requests = [];
  const fakeFetch = async (url, options) => {
    requests.push({ url, options });
    return {
      ok: requests.length === 1,
      status: requests.length === 1 ? 200 : 401,
      json: async () => assert.fail("HEAD schema probe must not read a response body"),
      text: async () => assert.fail("HEAD schema probe must not read a response body"),
    };
  };

  const present = await checkRestTable("https://petmanager-dev.example.invalid", "synthetic-test-key", "media_assets", fakeFetch);
  const rejected = await checkRestTable("https://petmanager-dev.example.invalid", "synthetic-test-key", "media_variants", fakeFetch);

  assert.deepEqual(requests.map(({ options }) => options.method), ["HEAD", "HEAD"]);
  assert.equal(present.exists, true);
  assert.equal(rejected.exists, false);
  assert.equal(rejected.message, "HTTP 401");
  assert.equal(requests[0].url, "https://petmanager-dev.example.invalid/rest/v1/media_assets?select=*&limit=1");
});

test("restore drill evidence must prove isolation and measured RPO/RTO within launch objectives", () => {
  const passingDrill = {
    status: "PASS",
    recoverablePointAt: "2026-10-01T12:00:00.000Z",
    incidentStartedAt: "2026-10-02T12:00:00.000Z",
    serviceVerifiedAt: "2026-10-02T15:59:00.000Z",
    completedAt: "2026-10-02T16:00:00.000Z",
    isolatedTargetVerified: true,
    rpoMinutes: MAX_RPO_MINUTES,
    rtoMinutes: MAX_RTO_MINUTES - 1,
    evidenceRef: "docs/operations/restore-drill-evidence.md",
  };

  assert.deepEqual(validateRestoreDrill("production database", passingDrill), []);
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, rpoMinutes: MAX_RPO_MINUTES - 1 }).some((failure) => failure.includes("RPO")));
  assert.ok(validateRestoreDrill("production media", { ...passingDrill, rtoMinutes: MAX_RTO_MINUTES }).some((failure) => failure.includes("RTO")));
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, recoverablePointAt: "2026-09-30T12:00:00.000Z" }).some((failure) => failure.includes("RPO")));
  assert.ok(validateRestoreDrill("production media", { ...passingDrill, serviceVerifiedAt: "2026-10-02T16:01:00.000Z" }).some((failure) => failure.includes("RTO")));
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, isolatedTargetVerified: false }).some((failure) => failure.includes("isolated target")));
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, evidenceRef: "" }).some((failure) => failure.includes("evidence reference")));
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, completedAt: "not-a-date" }).some((failure) => failure.includes("timestamp")));
  assert.ok(validateRestoreDrill("production database", { ...passingDrill, completedAt: "2026-02-30T12:00:00.000Z" }).some((failure) => failure.includes("timestamp")));
});

test("launch consistency detects missing blockers in synthetic readback fixtures", async () => {
  const releaseSha = "a".repeat(40);
  const recovery = {
    database: {
      protection: { dailyBackupsEnabled: false, pitrEnabled: false, encryptedOffsiteBackupEnabled: false },
      restoreDrill: { status: "BLOCKED" },
    },
    media: {
      runtimeEnvironmentReadback: { status: "UNVERIFIED" },
      objectRecovery: { configured: false },
      restoreDrill: { status: "NOT_RUN" },
    },
    priceGuideAi: { enabled: false, featureSetting: "false", apiKeyPresent: false, modelSupported: false, status: "UNVERIFIED" },
    productionLaunchGate: {
      expectedRelease: releaseSha,
      status: "BLOCKED",
      remainingBlockers: [
        "Supabase leaked-password protection is not enabled",
        "production database has no verified daily backup or PITR protection",
        "production database restore drill is not verified",
        "production media provider is not verified",
        "production AI photo price-guide is not verified",
        "production media object recovery is not configured",
        "production media restore drill is not verified",
        "production web error-alert destination is not verified",
        "production mobile error-alert destination is not verified",
      ],
    },
  };
  const supabase = { projects: { production: { securityAdvisors: { auth_leaked_password_protection: { level: "WARN" } } } } };
  const vercel = { projects: { web: { commitSha: releaseSha }, mobile: { commitSha: releaseSha } } };
  const observability = {
    projects: {
      web: { alerting: { status: "UNVERIFIED", destinationConfigured: false, testDelivery: "NOT_RUN" } },
      mobile: { alerting: { status: "UNVERIFIED", destinationConfigured: false, testDelivery: "NOT_RUN" } },
    },
  };
  const tenantIsolation = { developmentFixture: { status: "PASS", cleanupResidue: 0 } };
  const current = {
    recovery,
    supabase,
    vercel,
    observability,
    tenantIsolation,
    releaseInCurrentMaster: true,
    releaseSchemaAligned: true,
  };

  assert.deepEqual(validateLaunchReadbackConsistency(current), []);

  const staleAncestry = structuredClone(recovery);
  staleAncestry.productionLaunchGate.remainingBlockers.push(
    "production release is not verified as part of master",
  );
  assert.ok(validateLaunchReadbackConsistency({ ...current, recovery: staleAncestry })
    .some((failure) => failure.includes("release ancestry blocker")));

  const missingRestoreBlocker = structuredClone(recovery);
  missingRestoreBlocker.productionLaunchGate.remainingBlockers =
    missingRestoreBlocker.productionLaunchGate.remainingBlockers.filter(
      (blocker) => !blocker.startsWith("production database restore drill "),
    );
  assert.ok(validateLaunchReadbackConsistency({ ...current, recovery: missingRestoreBlocker })
    .some((failure) => failure.includes("database restore drill blocker")));
});

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

test("CI keeps the Supabase service-role key scoped only to explicitly enabled owner-auth smoke steps", async () => {
  const workflow = await read("../../.github/workflows/owner-auth-guard.yml");
  const ownerAuthJob = workflow.match(/  owner-auth-guard:\r?\n([\s\S]*?)(?=\r?\n  alimtalk-relay-security:)/)?.[1];
  assert.ok(ownerAuthJob, "owner auth guard job must exist");

  const jobEnvironment = ownerAuthJob.match(/^    env:\r?\n([\s\S]*?)(?=\r?\n    steps:)/m)?.[1] ?? "";
  assert.doesNotMatch(jobEnvironment, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.doesNotMatch(jobEnvironment, /DEV_TEST_OWNER_(?:EMAIL|PASSWORD)/);
  assert.match(jobEnvironment, /ALLOWED_DEV_SUPABASE_REFS: \$\{\{ vars\.ALLOWED_DEV_SUPABASE_REFS \}\}/);

  const smokeSteps = ownerAuthJob.match(/      - name: Run owner login smoke\r?\n([\s\S]*?)(?=\r?\n      - name:)/)?.[1] ?? "";
  const e2eSteps = ownerAuthJob.match(/      - name: Run owner login e2e\r?\n([\s\S]*?)(?=\r?\n      - name:)/)?.[1] ?? "";
  for (const step of [smokeSteps, e2eSteps]) {
    assert.match(step, /if: env\.OWNER_LOGIN_SMOKE_ENABLED == 'true'/);
    assert.match(step, /env:\r?\n\s+SUPABASE_SERVICE_ROLE_KEY: \$\{\{ secrets\.SUPABASE_SERVICE_ROLE_KEY \}\}/);
    assert.match(step, /DEV_TEST_OWNER_EMAIL: \$\{\{ secrets\.DEV_TEST_OWNER_EMAIL \}\}/);
    assert.match(step, /DEV_TEST_OWNER_PASSWORD: \$\{\{ secrets\.DEV_TEST_OWNER_PASSWORD \}\}/);
  }
  assert.match(e2eSteps, /OWNER_LOGIN_E2E_EMAIL: \$\{\{ secrets\.DEV_TEST_OWNER_EMAIL \}\}/);
  assert.equal((workflow.match(/SUPABASE_SERVICE_ROLE_KEY/g) ?? []).length, 4);
});

test("default predeploy entry points all use the complete web/mobile release gate", async () => {
  const rootPredeploy = await read("../../scripts/check-predeploy-release.cjs");
  const rootPackage = JSON.parse(await read("../../package.json"));
  const webPackage = JSON.parse(await read("package.json"));
  const mobilePackage = JSON.parse(await read("../../apps/mobile/package.json"));

  assert.match(rootPredeploy, /"test:flows"/);
  assert.match(rootPredeploy, /"check:media-architecture"/);
  assert.match(rootPredeploy, /"check:alimtalk-env:vercel"/);
  assert.doesNotMatch(rootPredeploy, /"check:supabase-cli-target:dev"/);
  assert.doesNotMatch(rootPredeploy, /"check:media-schema:dev"/);
  assert.equal(rootPackage.scripts.predeploy, "npm run predeploy:release");
  assert.equal(webPackage.scripts.predeploy, "node ../../scripts/check-predeploy-release.cjs");
  assert.equal(mobilePackage.scripts.predeploy, "node ../../scripts/check-predeploy-release.cjs");
  assert.match(webPackage.scripts["predeploy:auth"], /^node \.\.\/\.\.\/scripts\/check-predeploy-release\.cjs &&/);
  assert.match(webPackage.scripts["predeploy:auth"], /npm run smoke:owner-login:with-server/);
  assert.match(webPackage.scripts["predeploy:auth"], /npm run test:e2e:owner-login/);
});

test("Vercel upload boundaries exclude local environment files in every workspace", async () => {
  const ignoreFiles = await Promise.all([
    read("../../.vercelignore"),
    read(".vercelignore"),
    read("../mobile/.vercelignore"),
  ]);

  for (const ignoreFile of ignoreFiles) {
    for (const pattern of [".env", ".env.*", "**/.env", "**/.env.*"]) {
      assert.ok(ignoreFile.split(/\r?\n/).includes(pattern), `missing ${pattern} in a Vercel project ignore file`);
    }

    const matcher = ignore().add(ignoreFile);
    for (const environmentFile of [
      "backend/.env",
      "apps/web/.env.local",
      "apps/mobile/.env.production",
    ]) {
      assert.equal(matcher.ignores(environmentFile), true, `Vercel source filter must exclude ${environmentFile}`);
    }
  }
});

test("privacy operations gate requires CatchCall data and local-queue disclosures in both apps", async () => {
  const privacyGuard = await read("../../scripts/check-privacy-operations.cjs");

  for (const disclosure of [
    "Android 캐치콜",
    "수신 전화번호",
    "보호자 매칭",
    "암호화된 기기 저장소",
    "최대 50건",
    "로그아웃",
  ]) {
    assert.ok(privacyGuard.includes(disclosure), `missing CatchCall disclosure gate for ${disclosure}`);
  }
  assert.match(privacyGuard, /apps\/web\/src\/lib\/legal\/privacy-policy\.ts/);
  assert.match(privacyGuard, /apps\/mobile\/src\/lib\/legal\/privacy-policy\.ts/);
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
  const recoveryDrill = await read("../../scripts/lib/recovery-objectives.cjs");
  const releaseTracking = await read("../../scripts/check-release-tracked-files.cjs");
  const readiness = await read("../../scripts/check-saas-readiness.cjs");

  assert.match(launchGate, /dailyBackupsEnabled/);
  assert.match(launchGate, /pitrEnabled/);
  assert.match(launchGate, /encryptedOffsiteBackupEnabled/);
  assert.match(launchGate, /validateRestoreDrill\("production database"/);
  assert.match(launchGate, /validateRestoreDrill\("production media"/);
  assert.match(launchGate, /recovery-objectives\.cjs/);
  assert.match(readbackCheck, /validateRestoreDrill/);
  assert.match(launchGate, /production media object retention\/recovery configuration is not verified/);
  assert.match(recoveryDrill, /restore drill is not verified/);
  assert.match(recoveryDrill, /measured RPO/);
  assert.match(recoveryDrill, /measured RTO/);
  assert.match(recoveryDrill, /isolated target/);
  assert.match(recoveryDrill, /evidence reference/);
  assert.match(releaseTracking, /scripts\/lib\/recovery-objectives\.cjs/);
  assert.match(releaseTracking, /apps\/web\/tests\/server\/production-build-source-contract\.test\.mjs/);
  assert.match(readiness, /scripts\/lib\/recovery-objectives\.cjs/);
  assert.match(readbackCheck, /saas-recovery-readback-20261001\.json/);
  for (const deploymentBoundary of [".vercelignore", "apps/web/.vercelignore", "apps/mobile/.vercelignore"]) {
    assert.ok(releaseTracking.includes(`"${deploymentBoundary}"`), `${deploymentBoundary} must be part of the release tracked-files gate`);
  }
});

test("production launch blocks until the admin-only error inbox verifies web and mobile delivery", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");
  const evidence = {
    projects: {
      web: { runtimeErrorCountLast24h: 0, alerting: { status: "UNVERIFIED" } },
      mobile: { runtimeErrorCountLast24h: 0, alerting: { status: "UNVERIFIED" } },
    },
  };
  const adminInbox = {
    status: "UNVERIFIED",
    projects: { web: { testDelivery: "NOT_RUN" }, mobile: { testDelivery: "NOT_RUN" } },
  };

  assert.match(launchGate, /admin-error-inbox-readback-20261001\.json/);
  assert.match(launchGate, /admin-only operational error inbox is not verified/);
  assert.match(readbackCheck, /admin operational error inbox readback evidence is missing or mismatched/);
  assert.match(readbackCheck, /admin error inbox test readback is missing or mismatched/);
  assert.equal(evidence.projects.web.runtimeErrorCountLast24h, 0);
  assert.equal(evidence.projects.mobile.runtimeErrorCountLast24h, 0);
  assert.equal(evidence.projects.web.alerting.status, "UNVERIFIED");
  assert.equal(evidence.projects.mobile.alerting.status, "UNVERIFIED");
  assert.equal(adminInbox.status, "UNVERIFIED");
  assert.equal(adminInbox.projects.web.testDelivery, "NOT_RUN");
  assert.equal(adminInbox.projects.mobile.testDelivery, "NOT_RUN");
  assert.match(launchGate, /production \$\{target\} admin error inbox delivery is not verified/);
});

test("production launch blocks a release that is not in local and remote master", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");
  const evidence = { releaseRelationship: { masterContainsRelease: false, originMasterContainsRelease: false } };

  assert.match(launchGate, /production release is not verified as part of \$\{ref\}/);
  assert.doesNotMatch(launchGate, /ancestry readback does not match current Git refs/);
  assert.match(launchGate, /merge-base/);
  assert.match(launchGate, /origin\/master/);
  assert.match(launchGate, /actualReleaseAncestry\[ref\] = ancestry\.status === 0/);
  assert.match(readbackCheck, /Vercel production release ancestry readback is missing/);
  // These fields describe the old readback; the launch gate must use current Git refs.
  assert.equal(evidence.releaseRelationship.masterContainsRelease, false);
  assert.equal(evidence.releaseRelationship.originMasterContainsRelease, false);
});

test("production launch verifies the deployed release schema against production migrations", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const readbackCheck = await read("../../scripts/check-readback-evidence.cjs");
  const vercel = { releaseRelationship: { latestMigrationInRelease: "20260929131500", productionReleaseSchemaAligned: true } };
  const supabase = { projects: { production: { lastMigration: "20260929131500" } } };

  assert.match(launchGate, /production release migration history is not aligned/);
  assert.match(launchGate, /ls-tree/);
  assert.match(readbackCheck, /release migration-compatibility readback is missing/);
  assert.equal(vercel.releaseRelationship.latestMigrationInRelease, supabase.projects.production.lastMigration);
  assert.equal(vercel.releaseRelationship.productionReleaseSchemaAligned, true);
});

test("predeploy and production launch verify media provider configuration in both Vercel projects", async () => {
  const launchGate = await read("../../scripts/check-production-launch-readiness.cjs");
  const predeploy = await read("../../scripts/check-predeploy-release.cjs");
  const checker = await read("../../apps/web/scripts/check-media-provider-env-vercel.cjs");
  const rootPackage = JSON.parse(await read("../../package.json"));
  const webPackage = JSON.parse(await read("package.json"));

  assert.match(launchGate, /check-media-provider-env-vercel\.cjs/);
  assert.match(predeploy, /"check:media-provider:vercel"/);
  assert.equal(rootPackage.scripts["check:media-provider:vercel"], "npm run check:media-provider:vercel --workspace=@petmanager/web");
  assert.match(checker, /for \(const target of \["web", "mobile"\]\)/);
  assert.match(checker, /createTemporaryEnvFile/);
  assert.match(checker, /removeTemporaryEnvFile\(temporary\)/);
  assert.match(checker, /R2_SECRET_ACCESS_KEY/);
  assert.match(checker, /UNSUPPORTED_PROVIDER/);
  assert.doesNotMatch(checker, /console\.log\([^\n]*values\[/);
  assert.equal(webPackage.name, "@petmanager/web");
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
