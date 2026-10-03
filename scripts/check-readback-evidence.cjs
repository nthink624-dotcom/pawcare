const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { validateRestoreDrill, validateEvidenceReference } = require("./lib/recovery-objectives.cjs");
const { validateLaunchReadbackConsistency } = require("./lib/launch-readback-consistency.cjs");
const { isOperationalErrorCleanupScheduled } = require("./lib/operational-error-cleanup-readiness.cjs");

const root = path.resolve(__dirname, "..");
const failures = [];
const warnings = [];

function readJson(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing: ${relativePath}`);
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
  } catch {
    failures.push(`invalid JSON: ${relativePath}`);
    return null;
  }
}

const manifest = readJson("docs/operations/vercel-project-targets.json");
const vercelProjectSettings = readJson("docs/operations/vercel-project-settings-readback-20261001.json");
const supabase = readJson("docs/operations/supabase-readonly-readback-20261001.json");
const supabaseSecurityAdvisor = readJson("docs/operations/supabase-security-advisor-readback-20261002.json");
const vercel = readJson("docs/operations/vercel-readonly-readback-20261001.json");
const mediaProvider = readJson("docs/operations/vercel-media-provider-readback-20261001.json");
const recovery = readJson("docs/operations/saas-recovery-readback-20261001.json");
const encryptedBackup = readJson("docs/operations/supabase-encrypted-backup-readback-20261001.json");
const tenantIsolation = readJson("docs/operations/tenant-isolation-readback-20261001.json");
const browserAcl = readJson("docs/operations/supabase-browser-grants-readback-20261001.json");
const observability = readJson("docs/operations/vercel-observability-readback-20261001.json");
const adminErrorInbox = readJson("docs/operations/admin-error-inbox-readback-20261001.json");
const operationalErrorInbox = readJson("docs/operations/operational-error-inbox-readback-20261002.json");
const isReadbackDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isIsoTimestamp = (value) => typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
  Number.isFinite(Date.parse(value));

if (!isReadbackDate(recovery?.readAt)) {
  failures.push("recovery readback evidence must include an ISO calendar readAt date");
}
const databaseProtection = recovery?.database?.protection;
if (!["VERIFIED", "UNVERIFIED", "BLOCKED"].includes(databaseProtection?.latestRecoveryPointReadbackStatus) ||
    (databaseProtection.latestRecoveryPointAt !== null && !isIsoTimestamp(databaseProtection.latestRecoveryPointAt)) ||
    (databaseProtection.latestRecoveryPointReadbackStatus === "VERIFIED" && !isIsoTimestamp(databaseProtection.latestRecoveryPointAt))) {
  failures.push("database latest recoverable point readback is missing or invalid");
}
if (!isReadbackDate(mediaProvider?.readAt) ||
    mediaProvider?.deploymentEnvironmentSnapshot !== "UNVERIFIED" ||
    mediaProvider?.existingMediaObjectProvider !== "UNVERIFIED" ||
    mediaProvider?.r2RetentionLifecycleAndRestore !== "UNVERIFIED") {
  failures.push("Vercel media-provider readback must include a dated environment result and explicit runtime/object-recovery caveats");
}
for (const [target, expected] of [
  ["web", { projectId: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO", projectName: "petmanager" }],
  ["mobile", { projectId: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4", projectName: "petmanager-app" }],
]) {
  const project = mediaProvider?.projects?.[target];
  if (project?.projectId !== expected.projectId ||
      project?.projectName !== expected.projectName ||
      project?.configuredProvider !== "r2" ||
      project?.effectiveProvider !== "r2" ||
      project?.r2CredentialsComplete !== true ||
      project?.bucketConfigured !== true ||
      project?.status !== "PASS") {
    failures.push(`${target} current Vercel media-provider readback does not match the recorded R2 configuration`);
  }
}
if (recovery?.media?.runtimeEnvironmentReadback?.evidenceRef !== "docs/operations/vercel-media-provider-readback-20261001.json" ||
    recovery?.media?.runtimeEnvironmentReadback?.status !== "VERIFIED_R2_CONFIGURATION; DEPLOYMENT_SNAPSHOT_UNVERIFIED" ||
    recovery?.media?.objectRecovery?.configured !== false ||
    recovery?.productionLaunchGate?.remainingBlockers?.some((item) => /unsupported media provider|fall back to supabase/i.test(item))) {
  failures.push("consolidated recovery readback must reflect the latest R2 configuration without claiming deployment or object recovery");
}
const offlineBackupRestore = encryptedBackup?.offlineRestoreOnlyVerification;
if (!isReadbackDate(offlineBackupRestore?.verifiedAt) ||
    offlineBackupRestore?.status !== "PASS" ||
    offlineBackupRestore?.target !== "production" ||
    offlineBackupRestore?.networkAccess !== "none" ||
    offlineBackupRestore?.remoteReads !== 0 ||
    offlineBackupRestore?.remoteWrites !== 0 ||
    offlineBackupRestore?.sourceArchiveModified !== false ||
    offlineBackupRestore?.recoveryKeyModified !== false ||
    offlineBackupRestore?.archiveSha256 !== encryptedBackup?.backup?.sha256 ||
    offlineBackupRestore?.postgresMajorVarianceConstraintsPresent !== 9 ||
    offlineBackupRestore?.postgresMajorVarianceConstraintsValidated !== 9 ||
    offlineBackupRestore?.constraintBehaviorMatrix !== "PASS" ||
    offlineBackupRestore?.constraintBehaviorProbeCount !== 73 ||
    offlineBackupRestore?.semanticEquivalenceVerified !== false ||
    offlineBackupRestore?.sourceFingerprintComparison !== "NOT_PERFORMED" ||
    offlineBackupRestore?.rpoMinutes !== null ||
    offlineBackupRestore?.rtoMinutes !== null) {
  failures.push("production encrypted backup offline restore readback is missing, inconsistent, or overclaims recovery proof");
}
if (!isReadbackDate(vercelProjectSettings?.readAt)) {
  failures.push("Vercel project settings readback must include an ISO calendar readAt date");
}
for (const [target, expected] of [
  ["web", { projectId: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO", projectName: "petmanager", rootDirectory: "apps/web" }],
  ["mobile", { projectId: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4", projectName: "petmanager-app", rootDirectory: "apps/mobile" }],
]) {
  const settings = vercelProjectSettings?.projects?.[target];
  const manifestTarget = manifest?.[target];
  if (settings?.projectId !== expected.projectId ||
      settings?.projectName !== expected.projectName ||
      settings?.rootDirectory !== expected.rootDirectory ||
      settings?.sourceFilesOutsideRootDirectory !== true ||
      manifestTarget?.projectId !== settings.projectId ||
      manifestTarget?.projectName !== settings.projectName ||
      manifestTarget?.rootDirectory !== settings.rootDirectory ||
      manifestTarget?.sourceFilesOutsideRootDirectory !== settings.sourceFilesOutsideRootDirectory) {
    failures.push(`${target} Vercel project settings readback does not match the expected project, root, and shared-source configuration`);
  }
}
for (const [name, status] of [
  ["database restore drill", recovery?.database?.restoreDrill?.status],
  ["media restore drill", recovery?.media?.restoreDrill?.status],
]) {
  if (!["PASS", "NOT_RUN", "BLOCKED"].includes(status)) failures.push(`${name} status is missing or invalid`);
}
for (const [name, drill] of [
  ["production database", recovery?.database?.restoreDrill],
  ["production media", recovery?.media?.restoreDrill],
]) {
  if (drill?.status === "PASS") {
    failures.push(...validateRestoreDrill(name, drill));
    failures.push(...validateEvidenceReference(name, root, drill.evidenceRef, drill));
  }
}
for (const key of ["pitrEnabled", "encryptedOffsiteBackupEnabled"]) {
  if (typeof recovery?.database?.protection?.[key] !== "boolean") {
    failures.push(`recovery readback database protection field is missing: ${key}`);
  }
}
if (typeof recovery?.database?.protection?.dailyBackupsEnabled !== "boolean" &&
    !(recovery?.database?.protection?.dailyBackupsEnabled === null &&
      recovery?.database?.protection?.dailyBackupsReadbackStatus === "UNVERIFIED")) {
  failures.push("daily backup status must be verified or explicitly marked unverified");
}
if (typeof recovery?.media?.objectRecovery?.configured !== "boolean") {
  failures.push("recovery readback media object recovery configuration is missing");
}
if (typeof recovery?.priceGuideAi?.enabled !== "boolean" ||
    !["true", "false", "unset", "invalid"].includes(recovery?.priceGuideAi?.featureSetting) ||
    typeof recovery?.priceGuideAi?.apiKeyPresent !== "boolean" ||
    typeof recovery?.priceGuideAi?.modelSupported !== "boolean" ||
    !["PASS", "FEATURE_DISABLED", "INVALID_FEATURE_FLAG", "API_KEY_MISSING", "UNSUPPORTED_MODEL", "UNVERIFIED"].includes(recovery?.priceGuideAi?.status)) {
  failures.push("recovery readback AI photo price-guide status is missing or invalid");
}
if (!isReadbackDate(tenantIsolation?.readAt)) {
  failures.push("tenant-isolation readback evidence must include an ISO calendar readAt date");
}
if (!isReadbackDate(observability?.readAt)) {
  failures.push("Vercel observability readback evidence must include an ISO calendar readAt date");
}
if (!isReadbackDate(adminErrorInbox?.readAt) || adminErrorInbox?.route !== "/admin/operational-errors") {
  failures.push("admin operational error inbox readback evidence is missing or mismatched");
}
if (!isReadbackDate(operationalErrorInbox?.verifiedAt) ||
    operationalErrorInbox?.retentionCleanup?.localImplementation?.route !== "/api/cron/operational-errors/cleanup" ||
    operationalErrorInbox?.retentionCleanup?.localImplementation?.scheduleUtc !== "40 18 * * *" ||
    operationalErrorInbox?.retentionCleanup?.localImplementation?.retentionDays !== 30 ||
    operationalErrorInbox?.retentionCleanup?.localImplementation?.contractTestStatus !== "PASS") {
  failures.push("operational error retention cleanup local readback is missing or mismatched");
}
const cleanupReadback = operationalErrorInbox?.retentionCleanup?.productionReadback;
if (cleanupReadback?.projectId !== "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO" ||
    !["VERIFIED", "UNVERIFIED", "BLOCKED"].includes(cleanupReadback?.status) ||
    typeof cleanupReadback?.migrationApplied !== "boolean" ||
    ![true, false, null].includes(cleanupReadback?.vercelCronSecretConfigured) ||
    typeof cleanupReadback?.scheduledJobReadback?.globalCronJobsEnabled !== "boolean" ||
    typeof cleanupReadback?.scheduledJobReadback?.operationalErrorCleanupConfigured !== "boolean" ||
    !Array.isArray(cleanupReadback?.scheduledJobReadback?.productionJobs) ||
    !["PASS", "NOT_RUN", "BLOCKED"].includes(cleanupReadback?.lastInvocation?.status)) {
  failures.push("operational error retention cleanup production readback is missing or invalid");
}
if (cleanupReadback?.vercelCronSecretConfigured !== true) {
  failures.push("Vercel web production CRON_SECRET is not verified; release preflight must stop");
}
const cleanupJobIsScheduled = isOperationalErrorCleanupScheduled(
  cleanupReadback,
  operationalErrorInbox?.retentionCleanup?.localImplementation,
);
if (cleanupReadback?.status === "VERIFIED" &&
    (cleanupReadback.migrationApplied !== true ||
     cleanupReadback.vercelCronSecretConfigured !== true ||
     !cleanupJobIsScheduled ||
     cleanupReadback.lastInvocation.status !== "PASS" ||
     !isReadbackDate(cleanupReadback.lastInvocation.testedAt?.slice?.(0, 10)) ||
     cleanupReadback.lastInvocation.httpStatus !== 200 ||
     !Number.isInteger(cleanupReadback.lastInvocation.deletedCount) ||
     !/^[a-f0-9]{7,64}$/i.test(cleanupReadback.lastInvocation.releaseSha ?? ""))) {
  failures.push("verified operational error retention cleanup must include migration, secret, invocation, and release readbacks");
}
if (!["VERIFIED", "UNVERIFIED", "BLOCKED"].includes(adminErrorInbox?.status)) {
  failures.push("admin operational error inbox status is missing or invalid");
}
for (const [target, expectedProjectId] of [
  ["web", "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO"],
  ["mobile", "prj_uzTnmmuozy84cziu7T9IL1vOTdK4"],
]) {
  const entry = adminErrorInbox?.projects?.[target];
  if (entry?.projectId !== expectedProjectId || !["PASS", "NOT_RUN", "BLOCKED"].includes(entry?.testDelivery)) {
    failures.push(`${target} admin error inbox test readback is missing or mismatched`);
  }
  if (entry?.testDelivery === "PASS" &&
      (!isReadbackDate(entry?.testedAt?.slice?.(0, 10)) || !/^[a-f0-9-]{36}$/i.test(entry?.testEventId ?? "") || !/^(?:[a-f0-9]{7,64})$/i.test(entry?.releaseSha ?? ""))) {
    failures.push(`${target} passing admin error inbox readback must include test time, event ID, and release SHA`);
  }
}
for (const [target, expectedProjectId] of [
  ["web", "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO"],
  ["mobile", "prj_uzTnmmuozy84cziu7T9IL1vOTdK4"],
]) {
  const entry = observability?.projects?.[target];
  if (entry?.projectId !== expectedProjectId || !Number.isInteger(entry?.runtimeErrorCountLast24h)) {
    failures.push(`${target} Vercel runtime error readback is missing or mismatched`);
  }
  if (!["VERIFIED", "UNVERIFIED", "BLOCKED"].includes(entry?.alerting?.status)) {
    failures.push(`${target} Vercel alert-route status is missing or invalid`);
  }
  if (entry?.alerting?.status === "VERIFIED" &&
      (entry.alerting.destinationConfigured !== true || entry.alerting.testDelivery !== "PASS")) {
    failures.push(`${target} Vercel alert route must include a configured destination and passing test delivery`);
  }
}
if (![
  "PASS",
  "NOT_RUN",
  "BLOCKED",
].includes(tenantIsolation?.developmentFixture?.status)) {
  failures.push("development tenant-isolation fixture status is missing or invalid");
}
if (tenantIsolation?.developmentFixture?.status === "PASS" &&
    tenantIsolation?.developmentFixture?.cleanupResidue !== 0) {
  failures.push("passing tenant-isolation fixture must confirm zero cleanup residue");
}
for (const [target, expectedRef] of [
  ["development", "qefxdtmdtvnzgupmjlom"],
  ["production", "ysxykikqnneuhypybjry"],
]) {
  const entry = browserAcl?.projects?.[target];
  if (entry?.projectRef !== expectedRef ||
      entry?.browserGrantRows?.anon !== 0 ||
      entry?.browserGrantRows?.authenticated !== 0 ||
      entry?.publicTablesWithoutRls !== 0) {
    failures.push(`${target} Supabase browser grant readback is missing, mismatched, or not clean`);
  }
}
if (!isReadbackDate(browserAcl?.readAt)) {
  failures.push("Supabase browser-grant readback evidence must include an ISO calendar readAt date");
}

if (!isReadbackDate(supabase?.readAt) || !isReadbackDate(vercel?.readAt)) {
  failures.push("readback evidence must include an ISO calendar readAt date");
} else if (supabase.readAt !== vercel.readAt) {
  failures.push("Supabase and Vercel readback dates must match");
}

if (!isReadbackDate(supabaseSecurityAdvisor?.readAt) ||
    !isIsoTimestamp(supabaseSecurityAdvisor?.capturedAt) ||
    supabaseSecurityAdvisor?.readOnly !== true ||
    supabaseSecurityAdvisor?.source !== "Supabase MCP get_advisors(type=security)") {
  failures.push("current Supabase security-advisor readback must include a dated read-only source and capture time");
}
for (const [target, expectedRef] of [
  ["development", "qefxdtmdtvnzgupmjlom"],
  ["production", "ysxykikqnneuhypybjry"],
]) {
  const advisor = supabaseSecurityAdvisor?.projects?.[target];
  if (advisor?.ref !== expectedRef ||
      advisor.securityAdvisors?.auth_leaked_password_protection?.level !== "WARN" ||
      advisor.securityAdvisors?.auth_leaked_password_protection?.count !== 1 ||
      advisor.securityAdvisors?.auth_leaked_password_protection?.findingObservedAt !== null) {
    failures.push(`${target} current Supabase leaked-password advisor readback is missing, mismatched, or overclaims timestamp precision`);
  }
}

for (const [target, expected] of Object.entries({
  web: { id: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO", name: "petmanager", root: "apps/web" },
  mobile: { id: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4", name: "petmanager-app", root: "apps/mobile" },
})) {
  const entry = manifest?.[target];
  if (!entry) {
    failures.push(`Vercel manifest missing ${target}`);
    continue;
  }
  if (entry.projectId !== expected.id || entry.projectName !== expected.name || entry.rootDirectory !== expected.root) {
    failures.push(`Vercel manifest ${target} target mismatch`);
  }
}

for (const [target, expected] of Object.entries({
  development: { ref: "qefxdtmdtvnzgupmjlom", status: "ACTIVE_HEALTHY" },
  production: { ref: "ysxykikqnneuhypybjry", status: "ACTIVE_HEALTHY" },
})) {
  const entry = supabase?.projects?.[target];
  if (!entry) {
    failures.push(`Supabase readback missing ${target}`);
    continue;
  }
  if (entry.ref !== expected.ref || entry.status !== expected.status) {
    failures.push(`Supabase readback ${target} status/ref mismatch`);
  }
  if (!Number.isInteger(entry.migrationCount) || entry.migrationCount <= 0) {
    failures.push(`Supabase readback ${target} migration count is invalid`);
  }
  if (entry.securityAdvisors?.auth_leaked_password_protection?.level === "WARN") {
    warnings.push(`${target}: leaked-password protection remains a WARN in advisor readback`);
  }
}

for (const [target, expected] of Object.entries({
  web: { id: "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO", name: "petmanager", domain: "www.petmanager.co.kr" },
  mobile: { id: "prj_uzTnmmuozy84cziu7T9IL1vOTdK4", name: "petmanager-app", domain: "app.petmanager.co.kr" },
})) {
  const entry = vercel?.projects?.[target];
  if (!entry) {
    failures.push(`Vercel readback missing ${target}`);
    continue;
  }
  if (entry.projectId !== expected.id || entry.projectName !== expected.name || entry.deploymentState !== "READY") {
    failures.push(`Vercel readback ${target} deployment identity/state mismatch`);
  }
  if (!/^dpl_[A-Za-z0-9]+$/.test(entry.deploymentId ?? "")) {
    failures.push(`Vercel readback ${target} deployment id is missing or malformed`);
  }
  if (!/^[0-9a-f]{40}$/i.test(entry.commitSha ?? "")) {
    failures.push(`Vercel readback ${target} commit SHA is missing or malformed`);
  }
  if (!Array.isArray(entry.aliases) || !entry.aliases.some((alias) => alias === expected.domain)) {
    failures.push(`Vercel readback ${target} is missing the expected production alias`);
  }
  if (entry.endpointSmoke?.healthz !== 200 || entry.endpointSmoke?.readyz !== 200) {
    warnings.push(`${target}: production health/readiness smoke is not passing yet`);
  }
}

const webCommitSha = vercel?.projects?.web?.commitSha;
const mobileCommitSha = vercel?.projects?.mobile?.commitSha;
if (webCommitSha && mobileCommitSha && webCommitSha !== mobileCommitSha) {
  failures.push("web and mobile Vercel readbacks must reference the same release SHA");
}
if (typeof vercel?.releaseRelationship?.masterContainsRelease !== "boolean" ||
    typeof vercel?.releaseRelationship?.originMasterContainsRelease !== "boolean") {
  failures.push("Vercel production release ancestry readback is missing");
}
if (!/^\d{14}$/.test(vercel?.releaseRelationship?.latestMigrationInRelease ?? "") ||
    !/^\d{14}$/.test(vercel?.releaseRelationship?.productionDatabaseLastMigration ?? "") ||
    typeof vercel?.releaseRelationship?.productionReleaseSchemaAligned !== "boolean") {
  failures.push("Vercel production release migration-compatibility readback is missing");
}

const productionRls = supabase?.projects?.production?.publicTableRlsReadback;
if (
  !productionRls ||
  !Number.isInteger(productionRls.tableCount) ||
  !Number.isInteger(productionRls.tablesWithoutRls) ||
  !Number.isInteger(productionRls.tablesWithoutPolicies) ||
  !Number.isInteger(productionRls.browserTableGrantRows?.anon) ||
  !Number.isInteger(productionRls.browserTableGrantRows?.authenticated)
) {
  failures.push("Supabase production RLS metadata readback is missing or incomplete");
}

function isAncestorOfRef(commitSha, ref) {
  if (!/^[0-9a-f]{40}$/i.test(commitSha ?? "")) return null;
  const result = spawnSync("git", ["merge-base", "--is-ancestor", commitSha, ref], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  return null;
}

function latestMigrationInRelease(commitSha) {
  const result = spawnSync("git", ["ls-tree", "-r", "--name-only", commitSha, "--", "supabase/migrations"], {
    cwd: root,
    encoding: "utf8",
    windowsHide: true,
  });
  if (result.status !== 0) return null;
  const migrations = (result.stdout ?? "")
    .split(/\r?\n/)
    .filter((file) => /^supabase\/migrations\/\d{14}_.+\.sql$/.test(file))
    .sort();
  return migrations.at(-1)?.match(/(\d{14})_/)?.[1] ?? null;
}

if (recovery && supabase && vercel && tenantIsolation && observability && adminErrorInbox && operationalErrorInbox) {
  const releaseSha = vercel?.projects?.web?.commitSha;
  const inLocalMaster = isAncestorOfRef(releaseSha, "master");
  const inRemoteMaster = isAncestorOfRef(releaseSha, "origin/master");
  if (inLocalMaster === null || inRemoteMaster === null) {
    failures.push("production release ancestry could not be verified against current Git refs");
  }
  const latestReleaseMigration = latestMigrationInRelease(releaseSha);
  const productionMigration = supabase?.projects?.production?.lastMigration;
  const releaseSchemaAligned = Boolean(
    latestReleaseMigration &&
    latestReleaseMigration === productionMigration &&
    latestReleaseMigration === vercel?.releaseRelationship?.latestMigrationInRelease &&
    vercel?.releaseRelationship?.productionReleaseSchemaAligned === true,
  );
  failures.push(...validateLaunchReadbackConsistency({
    recovery,
    supabase,
    vercel,
    observability,
    adminErrorInbox,
    tenantIsolation,
    releaseInCurrentMaster: inLocalMaster === true && inRemoteMaster === true,
    releaseSchemaAligned,
  }));
}

if (failures.length > 0) {
  console.error("Readback evidence check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Readback evidence check: PASS (structure and target identity verified)");
for (const warning of warnings) console.log(`WARN: ${warning}`);
