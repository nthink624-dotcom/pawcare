const fs = require("node:fs");
const path = require("node:path");

const MAX_RPO_MINUTES = 24 * 60;
const MAX_RTO_MINUTES = 4 * 60;

function isIsoTimestamp(value) {
  if (typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) ||
      !Number.isFinite(Date.parse(value))) return false;

  const datePart = value.slice(0, 10);
  const midnight = Date.parse(`${datePart}T00:00:00.000Z`);
  return Number.isFinite(midnight) && new Date(midnight).toISOString().slice(0, 10) === datePart;
}

function validateRestoreDrill(label, drill) {
  if (drill?.status !== "PASS") return [`${label} restore drill is not verified`];

  const failures = [];
  const timestamps = [drill.recoverablePointAt, drill.incidentStartedAt, drill.serviceVerifiedAt, drill.completedAt];
  if (!timestamps.every(isIsoTimestamp)) {
    failures.push(`${label} passing restore drill must include ISO timestamps for the recoverable point, incident start, service verification, and completion`);
  }
  if (drill.isolatedTargetVerified !== true) {
    failures.push(`${label} passing restore drill must verify an isolated target`);
  }

  if (timestamps.every(isIsoTimestamp)) {
    const recoverablePointAt = Date.parse(drill.recoverablePointAt);
    const incidentStartedAt = Date.parse(drill.incidentStartedAt);
    const serviceVerifiedAt = Date.parse(drill.serviceVerifiedAt);
    const completedAt = Date.parse(drill.completedAt);

    if (recoverablePointAt > incidentStartedAt) {
      failures.push(`${label} recoverable data point must not be later than the incident start`);
    }
    if (serviceVerifiedAt < incidentStartedAt) {
      failures.push(`${label} service verification must not precede the incident start`);
    }
    if (completedAt < serviceVerifiedAt) {
      failures.push(`${label} drill completion must not precede service verification`);
    }

    // RPO is the age of the last recoverable data point when the incident begins.
    // RTO runs from incident start until the restored service passes verification.
    const measuredRpoMinutes = Math.ceil((incidentStartedAt - recoverablePointAt) / 60_000);
    const measuredRtoMinutes = Math.ceil((serviceVerifiedAt - incidentStartedAt) / 60_000);
    if (!Number.isFinite(drill.rpoMinutes) || drill.rpoMinutes !== measuredRpoMinutes) {
      failures.push(`${label} reported RPO must match the recoverable-point and incident timestamps (${measuredRpoMinutes} minutes)`);
    }
    if (!Number.isFinite(drill.rtoMinutes) || drill.rtoMinutes !== measuredRtoMinutes) {
      failures.push(`${label} reported RTO must match the incident and service-verification timestamps (${measuredRtoMinutes} minutes)`);
    }
    if (measuredRpoMinutes < 0 || measuredRpoMinutes > MAX_RPO_MINUTES) {
      failures.push(`${label} measured RPO must be between 0 and ${MAX_RPO_MINUTES} minutes`);
    }
    if (measuredRtoMinutes < 0 || measuredRtoMinutes > MAX_RTO_MINUTES) {
      failures.push(`${label} measured RTO must be between 0 and ${MAX_RTO_MINUTES} minutes`);
    }
  }
  if (typeof drill.evidenceRef !== "string" || drill.evidenceRef.trim().length === 0) {
    failures.push(`${label} passing restore drill must include an evidence reference`);
  }
  return failures;
}

function validateBackupFreshness(label, protection, now = new Date()) {
  const failures = [];
  const recoveryPoint = protection?.latestRecoveryPointAt;
  const readbackStatus = protection?.latestRecoveryPointReadbackStatus;
  const nowMs = now instanceof Date ? now.getTime() : Date.parse(now);

  if (readbackStatus !== "VERIFIED") {
    failures.push(`${label} latest recoverable data point is not verified`);
  }
  if (!isIsoTimestamp(recoveryPoint)) {
    failures.push(`${label} must include an ISO timestamp for its latest recoverable data point`);
  } else if (!Number.isFinite(nowMs)) {
    failures.push(`${label} backup freshness check requires a valid current time`);
  } else {
    const ageMs = nowMs - Date.parse(recoveryPoint);
    const ageMinutes = Math.ceil(ageMs / 60_000);
    if (ageMs < 0) failures.push(`${label} latest recoverable data point must not be in the future`);
    if (ageMs >= 0 && ageMinutes > MAX_RPO_MINUTES) {
      failures.push(`${label} latest recoverable data point is ${ageMinutes} minutes old; maximum RPO is ${MAX_RPO_MINUTES} minutes`);
    }
  }

  const recurringProtection = protection?.dailyBackupsEnabled === true ||
    protection?.pitrEnabled === true ||
    (protection?.encryptedOffsiteBackupEnabled === true && protection?.encryptedOffsiteBackupMode === "DAILY_AUTOMATED");
  if (!recurringProtection) {
    failures.push(`${label} has no verified recurring backup or PITR protection`);
  }

  return failures;
}

function validateSecondDeviceRecovery(label, backup, evidenceRoot, expectedArchiveSha256) {
  const failures = [];
  if (backup?.secondDeviceReadback !== "VERIFIED") {
    failures.push(`${label} recovery key has not been verified from a second device`);
    return failures;
  }

  const evidenceRef = backup?.secondDeviceEvidenceRef;
  if (typeof evidenceRef !== "string" || evidenceRef.trim().length === 0 || path.isAbsolute(evidenceRef)) {
    return [`${label} second-device recovery evidence reference is missing or invalid`];
  }

  const root = path.resolve(evidenceRoot);
  const candidate = path.resolve(root, evidenceRef);
  const lexicalRelative = path.relative(root, candidate);
  if (!lexicalRelative || lexicalRelative === "." || lexicalRelative === ".." || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
    return [`${label} second-device evidence reference must identify a file inside the repository`];
  }

  let receipt;
  try {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (!realRelative || realRelative === "." || realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative) || !fs.statSync(realCandidate).isFile()) {
      return [`${label} second-device evidence file must resolve inside the repository`];
    }
    receipt = JSON.parse(fs.readFileSync(realCandidate, "utf8"));
  } catch {
    return [`${label} second-device evidence file is missing, invalid, or cannot be read`];
  }

  if (receipt?.status !== "PASS" ||
      !isIsoTimestamp(receipt?.verifiedAt) ||
      receipt?.deviceType !== "second_windows_pc" ||
      receipt?.keySource !== "removable_usb" ||
      receipt?.networkAccess !== "none" ||
      receipt?.remoteWrites !== 0 ||
      !/^[a-f0-9]{64}$/i.test(receipt?.archiveSha256 ?? "") ||
      receipt.archiveSha256.toLowerCase() !== String(expectedArchiveSha256 ?? "").toLowerCase()) {
    failures.push(`${label} second-device evidence does not prove an offline restore of the recorded encrypted archive`);
  }

  return failures;
}

function validateEvidenceReference(label, evidenceRoot, evidenceRef, drill) {
  if (typeof evidenceRef !== "string" || evidenceRef.trim().length === 0) {
    return [`${label} restore evidence reference is missing`];
  }

  if (path.isAbsolute(evidenceRef)) {
    return [`${label} restore evidence reference must be relative to the repository`];
  }

  const root = path.resolve(evidenceRoot);
  const candidate = path.resolve(root, evidenceRef);
  const lexicalRelative = path.relative(root, candidate);
  if (!lexicalRelative || lexicalRelative === "." || lexicalRelative === ".." || lexicalRelative.startsWith(`..${path.sep}`) || path.isAbsolute(lexicalRelative)) {
    return [`${label} restore evidence reference must identify a file inside the repository`];
  }

  try {
    const realRoot = fs.realpathSync(root);
    const realCandidate = fs.realpathSync(candidate);
    const realRelative = path.relative(realRoot, realCandidate);
    if (!realRelative || realRelative === "." || realRelative === ".." || realRelative.startsWith(`..${path.sep}`) || path.isAbsolute(realRelative)) {
      return [`${label} restore evidence reference must resolve inside the repository`];
    }
    if (!fs.statSync(realCandidate).isFile()) {
      return [`${label} restore evidence reference must identify an existing file`];
    }
  } catch {
    return [`${label} restore evidence file does not exist or cannot be read`];
  }

  let receipt;
  try {
    receipt = JSON.parse(fs.readFileSync(candidate, "utf8"));
  } catch {
    return [`${label} restore evidence file must contain a valid JSON receipt`];
  }

  const matchingFields = [
    "status",
    "recoverablePointAt",
    "incidentStartedAt",
    "serviceVerifiedAt",
    "completedAt",
    "isolatedTargetVerified",
    "rpoMinutes",
    "rtoMinutes",
  ];
  const mismatchedFields = matchingFields.filter((field) => receipt?.[field] !== drill?.[field]);
  if (mismatchedFields.length > 0) {
    return [`${label} restore evidence receipt does not match the readback fields: ${mismatchedFields.join(", ")}`];
  }

  return [];
}

module.exports = {
  MAX_RPO_MINUTES,
  MAX_RTO_MINUTES,
  validateBackupFreshness,
  validateSecondDeviceRecovery,
  validateRestoreDrill,
  validateEvidenceReference,
};
