const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateBackupFreshness, validateSecondDeviceRecovery, validateRestoreDrill } = require("./lib/recovery-objectives.cjs");
const { isOperationalErrorCleanupScheduled } = require("./lib/operational-error-cleanup-readiness.cjs");

const root = path.resolve(__dirname, "..");
const failures = [];

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : "";
}

const expectedRelease = argument("--expected-release");
if (!/^[0-9a-f]{40}$/i.test(expectedRelease)) {
  console.error("Production launch gate: BLOCKED - pass --expected-release <Git SHA>");
  process.exit(1);
}

const releaseCommitCheck = spawnSync("git", ["cat-file", "-e", `${expectedRelease}^{commit}`], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
const actualReleaseAncestry = {};
if (releaseCommitCheck.status !== 0) {
  failures.push("expected production release commit is not present in the local Git object database");
} else {
  for (const ref of ["master", "origin/master"]) {
    const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", expectedRelease, ref], {
      cwd: root,
      encoding: "utf8",
      windowsHide: true,
    });
    actualReleaseAncestry[ref] = ancestry.status === 0;
    if (!actualReleaseAncestry[ref]) failures.push(`production release is not verified as part of ${ref}`);
  }
}

const readbackEvidenceCheck = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-readback-evidence.cjs")],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (readbackEvidenceCheck.status !== 0) {
  failures.push("readback evidence structure or target identity check did not pass");
  const report = `${readbackEvidenceCheck.stdout ?? ""}\n${readbackEvidenceCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

const endpointCheck = spawnSync(
  process.execPath,
  [path.join(root, "scripts/check-production-endpoints.cjs"), "--include-readiness", "--expected-release", expectedRelease],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
if (endpointCheck.status !== 0) {
  failures.push("production health/readiness endpoint contract did not pass");
  const report = `${endpointCheck.stdout ?? ""}\n${endpointCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

// The predeploy gate checks the same values before a release, but the final
// production launch gate must read them back again after deployment. This is
// intentionally read-only: the helper pulls Vercel production env into a
// task-scoped temporary file, compares allowlisted keys, then removes it.
const webRoot = path.join(root, "apps/web");
const alimtalkCheck = spawnSync(
  process.execPath,
  [
    path.join(webRoot, "scripts/check-alimtalk-template-env-consistency.cjs"),
    "--pull-vercel-production",
  ],
  { cwd: webRoot, encoding: "utf8", windowsHide: true },
);
if (alimtalkCheck.status !== 0) {
  failures.push("production Alimtalk relay/template environment readback did not pass");
  const report = `${alimtalkCheck.stdout ?? ""}\n${alimtalkCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

const paymentCheck = spawnSync(
  process.execPath,
  [path.join(webRoot, "scripts/check-payment-env-vercel.cjs"), "--pull-vercel-production"],
  { cwd: webRoot, encoding: "utf8", windowsHide: true },
);
if (paymentCheck.status !== 0) {
  failures.push("production PortOne payment environment readback did not pass");
  const report = `${paymentCheck.stdout ?? ""}\n${paymentCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

const mediaProviderCheck = spawnSync(
  process.execPath,
  [path.join(webRoot, "scripts/check-media-provider-env-vercel.cjs"), "--pull-vercel-production"],
  { cwd: webRoot, encoding: "utf8", windowsHide: true },
);
if (mediaProviderCheck.status !== 0) {
  failures.push("production web/mobile media-provider configuration is unsupported or incomplete");
  const report = `${mediaProviderCheck.stdout ?? ""}\n${mediaProviderCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

const priceGuideAiCheck = spawnSync(
  process.execPath,
  [path.join(webRoot, "scripts/check-price-guide-ai-env-vercel.cjs"), "--pull-vercel-production"],
  { cwd: webRoot, encoding: "utf8", windowsHide: true },
);
if (priceGuideAiCheck.status !== 0) {
  failures.push("production AI photo price-guide environment is disabled, incomplete, or unsupported");
  const report = `${priceGuideAiCheck.stdout ?? ""}\n${priceGuideAiCheck.stderr ?? ""}`.trim();
  if (report) console.error(report);
}

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    failures.push(`missing or invalid readback: ${relativePath}`);
    return null;
  }
}

const supabase = readJson("docs/operations/supabase-readonly-readback-20261001.json");
const vercel = readJson("docs/operations/vercel-readonly-readback-20261001.json");
const recovery = readJson("docs/operations/saas-recovery-readback-20261001.json");
const encryptedBackup = readJson("docs/operations/supabase-encrypted-backup-readback-20261001.json");
const browserAcl = readJson("docs/operations/supabase-browser-grants-readback-20261001.json");
const observability = readJson("docs/operations/vercel-observability-readback-20261001.json");
const adminErrorInbox = readJson("docs/operations/admin-error-inbox-readback-20261001.json");
const operationalErrorInbox = readJson("docs/operations/operational-error-inbox-readback-20261002.json");
const productionSecurity = supabase?.projects?.production?.securityAdvisors ?? {};
const productionRls = supabase?.projects?.production?.publicTableRlsReadback ?? {};
if (productionSecurity.auth_leaked_password_protection?.level === "WARN") {
  failures.push("production Supabase leaked-password protection is still WARN");
}
if (browserAcl?.projects?.production?.browserGrantRows?.anon !== 0 ||
    browserAcl?.projects?.production?.browserGrantRows?.authenticated !== 0) {
  failures.push("latest production Supabase browser table-grant readback is not clean");
}
if (!Number.isInteger(productionRls.tableCount) || !Number.isInteger(productionRls.tablesWithoutRls) || !Number.isInteger(productionRls.tablesWithoutPolicies)) {
  failures.push("production Supabase RLS metadata readback is missing or incomplete");
}
if (Number.isInteger(productionRls.tablesWithoutRls) && productionRls.tablesWithoutRls > 0) {
  failures.push(`production Supabase has ${productionRls.tablesWithoutRls} public tables without RLS`);
}
// Some RLS-enabled tables intentionally have no browser policies because they
// are server-only. The launch gate must enforce the actual exposure boundary:
// browser grants must be revoked, not require every server-only table to have a
// client policy.
if (Number.isInteger(productionRls.tablesWithoutPolicies) && productionRls.tablesWithoutPolicies > 0) {
  console.log(`INFO: production Supabase retains ${productionRls.tablesWithoutPolicies} server-only RLS tables without browser policies`);
}
const browserGrantRows = productionRls.browserTableGrantRows ?? {};
for (const role of ["anon", "authenticated"]) {
  if (!Number.isInteger(browserGrantRows[role])) {
    failures.push(`production Supabase RLS metadata is missing browser grant rows for ${role}`);
  } else if (browserGrantRows[role] > 0) {
    failures.push(`production Supabase retains ${browserGrantRows[role]} public table grant rows for ${role}`);
  }
}
if (vercel?.projects?.web?.commitSha !== expectedRelease || vercel?.projects?.mobile?.commitSha !== expectedRelease) {
  failures.push("readback evidence does not show both Vercel projects on the expected release");
}
// The readback file stores the Git-ref relationship at the time it was
// captured. Refs can advance afterward; current ancestry is verified directly
// above and must not be rejected because that historical snapshot is stale.
if (vercel?.releaseRelationship?.productionReleaseSchemaAligned !== true ||
    vercel?.releaseRelationship?.latestMigrationInRelease !== supabase?.projects?.production?.lastMigration) {
  failures.push("production release migration history is not aligned with the applied production database schema");
}
const releaseMigrationTree = spawnSync(
  "git",
  ["ls-tree", "-r", "--name-only", expectedRelease, "--", "supabase/migrations"],
  { cwd: root, encoding: "utf8", windowsHide: true },
);
const releaseMigrationNames = (releaseMigrationTree.stdout ?? "")
  .split(/\r?\n/)
  .filter((file) => /^supabase\/migrations\/\d{14}_.+\.sql$/.test(file))
  .sort();
const latestReleaseMigration = releaseMigrationNames.at(-1)?.match(/(\d{14})_/)?.[1] ?? null;
if (releaseMigrationTree.status !== 0 || !latestReleaseMigration ||
    latestReleaseMigration !== supabase?.projects?.production?.lastMigration) {
  failures.push("expected production release Git tree does not match the applied production database migration history");
}
for (const target of ["web", "mobile"]) {
  const smoke = vercel?.projects?.[target]?.endpointSmoke;
  if (smoke?.healthz !== 200 || smoke?.readyz !== 200) failures.push(`${target} readback endpoint smoke is not 200/200`);
}

const databaseRecovery = recovery?.database ?? {};
failures.push(...validateBackupFreshness("production database", databaseRecovery.protection));
if (databaseRecovery.protection?.dailyBackupsEnabled !== true &&
    databaseRecovery.protection?.pitrEnabled !== true &&
    databaseRecovery.protection?.encryptedOffsiteBackupEnabled !== true) {
  failures.push("production database has no verified daily backup, PITR, or encrypted off-site backup protection");
}
failures.push(...validateRestoreDrill("production database", databaseRecovery.restoreDrill));
if (databaseRecovery.protection?.encryptedOffsiteBackupEnabled === true) {
  failures.push(...validateSecondDeviceRecovery(
    "production database",
    databaseRecovery.protection?.encryptedOffsiteBackup,
    root,
    encryptedBackup?.backup?.sha256,
  ));
}
const mediaRecovery = recovery?.media ?? {};
if (mediaRecovery.objectRecovery?.configured !== true) {
  failures.push("production media object retention/recovery configuration is not verified");
}
failures.push(...validateRestoreDrill("production media", mediaRecovery.restoreDrill));
if (adminErrorInbox?.status !== "VERIFIED" || adminErrorInbox?.route !== "/admin/operational-errors") {
  failures.push("admin-only operational error inbox is not verified");
}
const cleanupReadback = operationalErrorInbox?.retentionCleanup?.productionReadback;
const cleanupJobIsScheduled = isOperationalErrorCleanupScheduled(
  cleanupReadback,
  operationalErrorInbox?.retentionCleanup?.localImplementation,
);
if (cleanupReadback?.status !== "VERIFIED" ||
    cleanupReadback?.migrationApplied !== true ||
    cleanupReadback?.vercelCronSecretConfigured !== true ||
    !cleanupJobIsScheduled ||
    cleanupReadback?.lastInvocation?.status !== "PASS" ||
    cleanupReadback?.lastInvocation?.httpStatus !== 200) {
  failures.push("production operational error retention cleanup is not verified");
}
for (const target of ["web", "mobile"]) {
  const delivery = adminErrorInbox?.projects?.[target];
  if (delivery?.testDelivery !== "PASS" || !delivery?.testEventId || !delivery?.releaseSha) {
    failures.push(`production ${target} admin error inbox delivery is not verified`);
  }
}
const tenantIsolation = readJson("docs/operations/tenant-isolation-readback-20261001.json");
if (tenantIsolation?.developmentFixture?.status !== "PASS" || tenantIsolation?.developmentFixture?.cleanupResidue !== 0) {
  failures.push("development cross-tenant isolation fixture has not passed with zero cleanup residue");
}

if (failures.length > 0) {
  console.error("Production launch gate: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production launch gate: PASS (${expectedRelease})`);
