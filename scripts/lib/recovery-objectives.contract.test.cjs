const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const test = require("node:test");
const path = require("node:path");

const {
  MAX_RPO_MINUTES,
  MAX_RTO_MINUTES,
  validateBackupFreshness,
  validateSecondDeviceRecovery,
  validateRestoreDrill,
  validateEvidenceReference,
} = require("./recovery-objectives.cjs");

const baseDrill = {
  status: "PASS",
  recoverablePointAt: "2026-10-01T12:00:00.000Z",
  incidentStartedAt: "2026-10-02T12:00:00.000Z",
  serviceVerifiedAt: "2026-10-02T15:59:00.000Z",
  completedAt: "2026-10-02T16:00:00.000Z",
  isolatedTargetVerified: true,
  rpoMinutes: MAX_RPO_MINUTES,
  rtoMinutes: MAX_RTO_MINUTES - 1,
  evidenceRef: "restore-receipt.json",
};

const freshProtection = {
  latestRecoveryPointAt: "2026-10-02T11:00:00.000Z",
  latestRecoveryPointReadbackStatus: "VERIFIED",
  dailyBackupsEnabled: true,
  pitrEnabled: false,
  encryptedOffsiteBackupEnabled: false,
  encryptedOffsiteBackupMode: "DISABLED",
};

test("backup freshness accepts a verified recurring recovery point within the RPO window", () => {
  assert.deepEqual(validateBackupFreshness("production database", freshProtection, new Date("2026-10-02T12:00:00.000Z")), []);
});

test("backup freshness rejects missing, stale, or future recovery points", () => {
  assert.ok(validateBackupFreshness("database", { ...freshProtection, latestRecoveryPointAt: null }, new Date("2026-10-02T12:00:00.000Z")).some((failure) => failure.includes("ISO timestamp")));
  assert.ok(validateBackupFreshness("database", { ...freshProtection, latestRecoveryPointAt: "2026-10-01T11:59:00.000Z" }, new Date("2026-10-02T12:00:00.000Z")).some((failure) => failure.includes("maximum RPO")));
  assert.ok(validateBackupFreshness("database", { ...freshProtection, latestRecoveryPointAt: "2026-10-02T12:01:00.000Z" }, new Date("2026-10-02T12:00:00.000Z")).some((failure) => failure.includes("future")));
});

test("backup freshness rejects one-off manual protection even when the file is recent", () => {
  const manualOneOff = {
    ...freshProtection,
    dailyBackupsEnabled: false,
    encryptedOffsiteBackupEnabled: true,
    encryptedOffsiteBackupMode: "MANUAL_ONE_OFF",
  };
  assert.ok(validateBackupFreshness("production database", manualOneOff, new Date("2026-10-02T12:00:00.000Z")).some((failure) => failure.includes("recurring backup")));
});

test("a one-off production backup fixture cannot satisfy RPO without a verified recovery-point timestamp", () => {
  const productionProtection = {
    dailyBackupsEnabled: false,
    pitrEnabled: false,
    encryptedOffsiteBackupEnabled: true,
    encryptedOffsiteBackupMode: "MANUAL_ONE_OFF",
    latestRecoveryPointReadbackStatus: "UNVERIFIED",
    latestRecoveryPointAt: null,
  };
  const failures = validateBackupFreshness("production database", productionProtection, new Date("2026-10-02T12:00:00.000Z"));
  assert.ok(failures.some((failure) => failure.includes("not verified")));
  assert.ok(failures.some((failure) => failure.includes("ISO timestamp")));
  assert.ok(failures.some((failure) => failure.includes("recurring backup")));
});

test("encrypted recovery key requires a matching offline restore receipt from a second Windows PC", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "petmanager-second-device-recovery-"));
  const evidencePath = path.join(tempRoot, "second-device-restore.json");
  const backup = {
    secondDeviceReadback: "VERIFIED",
    secondDeviceEvidenceRef: "second-device-restore.json",
  };
  const archiveSha256 = "a".repeat(64);
  const receipt = {
    status: "PASS",
    verifiedAt: "2026-10-02T12:00:00.000Z",
    deviceType: "second_windows_pc",
    keySource: "removable_usb",
    networkAccess: "none",
    remoteWrites: 0,
    archiveSha256,
  };

  try {
    assert.ok(validateSecondDeviceRecovery("production database", { ...backup, secondDeviceReadback: "NOT_VERIFIED" }, tempRoot)
      .some((failure) => failure.includes("second device")));
    fs.writeFileSync(evidencePath, JSON.stringify(receipt), "utf8");
    assert.deepEqual(validateSecondDeviceRecovery("production database", backup, tempRoot, archiveSha256), []);
    assert.ok(validateSecondDeviceRecovery("production database", backup, tempRoot)
      .some((failure) => failure.includes("recorded encrypted archive")));
    assert.ok(validateSecondDeviceRecovery("production database", backup, tempRoot, "0".repeat(64))
      .some((failure) => failure.includes("recorded encrypted archive")));
    assert.ok(validateSecondDeviceRecovery("production database", {
      ...backup,
      secondDeviceEvidenceRef: "../outside.json",
    }, tempRoot).some((failure) => failure.includes("inside the repository")));
  } finally {
    const resolvedRoot = path.resolve(tempRoot);
    const resolvedTemp = path.resolve(os.tmpdir());
    if (resolvedRoot.startsWith(`${resolvedTemp}${path.sep}`)) fs.rmSync(resolvedRoot, { recursive: true, force: true });
  }
});

test("production recovery fixture remains blocked until the removable key is proven on another PC", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const backup = { secondDeviceReadback: "NOT_VERIFIED" };
  const expectedArchiveSha256 = "a".repeat(64);
  assert.equal(backup.secondDeviceReadback, "NOT_VERIFIED");
  assert.ok(validateSecondDeviceRecovery("production database", backup, repoRoot, expectedArchiveSha256)
    .some((failure) => failure.includes("second device")));
});

test("production launch readiness gate enforces second-device recovery proof", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  const launchGate = fs.readFileSync(path.join(repoRoot, "scripts/check-production-launch-readiness.cjs"), "utf8");
  assert.match(launchGate, /validateSecondDeviceRecovery\(/);
  assert.match(launchGate, /encryptedBackup\?\.backup\?\.sha256/);
});

test("restore objectives derive RPO/RTO from ordered event timestamps", () => {
  assert.deepEqual(validateRestoreDrill("database", baseDrill), []);
});

test("restore objectives reject reported minutes that do not match measured timestamps", () => {
  assert.ok(validateRestoreDrill("database", { ...baseDrill, rpoMinutes: MAX_RPO_MINUTES - 1 }).some((failure) => failure.includes("RPO")));
  assert.ok(validateRestoreDrill("database", { ...baseDrill, rtoMinutes: MAX_RTO_MINUTES }).some((failure) => failure.includes("RTO")));
});

test("restore objectives reject data points or service verification outside the target windows", () => {
  assert.ok(validateRestoreDrill("database", { ...baseDrill, recoverablePointAt: "2026-09-30T12:00:00.000Z" }).some((failure) => failure.includes("RPO")));
  assert.ok(validateRestoreDrill("database", { ...baseDrill, serviceVerifiedAt: "2026-10-02T16:01:00.000Z" }).some((failure) => failure.includes("RTO")));
});

test("restore objectives reject timestamps in an impossible order", () => {
  const failures = validateRestoreDrill("database", {
    ...baseDrill,
    recoverablePointAt: "2026-10-02T13:00:00.000Z",
    serviceVerifiedAt: "2026-10-02T11:59:00.000Z",
    completedAt: "2026-10-02T11:58:00.000Z",
  });
  assert.ok(failures.some((failure) => failure.includes("recoverable data point")));
  assert.ok(failures.some((failure) => failure.includes("service verification")));
  assert.ok(failures.some((failure) => failure.includes("completion")));
});

test("restore objectives require the evidence timestamps instead of trusting a manual PASS", () => {
  const { recoverablePointAt, ...missingMeasurement } = baseDrill;
  assert.ok(validateRestoreDrill("database", missingMeasurement).some((failure) => failure.includes("timestamp")));
});

test("restore evidence references must resolve to existing repository files", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  assert.ok(validateEvidenceReference("database", repoRoot, "missing-restore-evidence.json", baseDrill).some((failure) => failure.includes("does not exist")));
  assert.ok(validateEvidenceReference("database", repoRoot, "scripts", baseDrill).some((failure) => failure.includes("existing file")));
});

test("restore evidence references reject absolute and repository-escaping paths", () => {
  const repoRoot = path.resolve(__dirname, "../..");
  assert.ok(validateEvidenceReference("database", repoRoot, path.join(repoRoot, "package.json"), baseDrill).some((failure) => failure.includes("relative to the repository")));
  assert.ok(validateEvidenceReference("database", repoRoot, "../outside-evidence.json", baseDrill).some((failure) => failure.includes("inside the repository")));
});

test("restore evidence receipt must be valid JSON matching the readback measurements", () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "petmanager-restore-evidence-"));
  const evidencePath = path.join(tempRoot, "restore-receipt.json");
  try {
    fs.writeFileSync(evidencePath, JSON.stringify(baseDrill), "utf8");
    assert.deepEqual(validateEvidenceReference("database", tempRoot, "restore-receipt.json", baseDrill), []);

    fs.writeFileSync(evidencePath, JSON.stringify({ ...baseDrill, rtoMinutes: 5 }), "utf8");
    assert.ok(validateEvidenceReference("database", tempRoot, "restore-receipt.json", baseDrill).some((failure) => failure.includes("does not match")));

    fs.writeFileSync(evidencePath, "not-json", "utf8");
    assert.ok(validateEvidenceReference("database", tempRoot, "restore-receipt.json", baseDrill).some((failure) => failure.includes("valid JSON")));
  } finally {
    const tempPath = path.resolve(tempRoot);
    const tempBase = path.resolve(os.tmpdir());
    if (tempPath.startsWith(`${tempBase}${path.sep}`)) fs.rmSync(tempPath, { recursive: true, force: true });
  }
});
