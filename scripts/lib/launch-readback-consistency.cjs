const { validateRestoreDrill } = require("./recovery-objectives.cjs");

function validateLaunchReadbackConsistency({
  recovery,
  supabase,
  vercel,
  observability,
  tenantIsolation,
  releaseInCurrentMaster,
  releaseSchemaAligned,
}) {
  const failures = [];
  const snapshot = recovery?.productionLaunchGate;
  const blockers = snapshot?.remainingBlockers;

  if (!snapshot || !Array.isArray(blockers) || blockers.some((blocker) => typeof blocker !== "string")) {
    return ["production launch readback summary is missing or malformed"];
  }

  const releaseSha = vercel?.projects?.web?.commitSha;
  if (!releaseSha || snapshot.expectedRelease !== releaseSha || vercel?.projects?.mobile?.commitSha !== releaseSha) {
    failures.push("production launch summary expected release does not match both deployed projects");
  }

  const expectBlocker = (condition, marker, label) => {
    const recorded = blockers.some((blocker) => marker.test(blocker));
    if (condition !== recorded) {
      failures.push(`production launch summary ${label} blocker does not match the readback evidence`);
    }
  };

  const productionAuthWarn =
    supabase?.projects?.production?.securityAdvisors?.auth_leaked_password_protection?.level === "WARN";
  expectBlocker(productionAuthWarn, /leaked-password protection/i, "leaked-password protection");

  const protection = recovery?.database?.protection ?? {};
  const databaseHasBackup =
    protection.dailyBackupsEnabled === true ||
    protection.pitrEnabled === true ||
    protection.encryptedOffsiteBackupEnabled === true;
  expectBlocker(
    !databaseHasBackup,
    /production database has no verified daily backup|database backup protection/i,
    "database backup protection",
  );

  const databaseRestorePassed = validateRestoreDrill("production database", recovery?.database?.restoreDrill).length === 0;
  expectBlocker(!databaseRestorePassed, /production database restore drill/i, "database restore drill");

  const providerReadback = recovery?.media?.runtimeEnvironmentReadback;
  const mediaProviderUnverified = providerReadback?.status !== "VERIFIED_SUPPORTED_PROVIDER";
  expectBlocker(
    mediaProviderUnverified,
    /unsupported media provider|media provider|media-provider configuration/i,
    "media provider",
  );

  const priceGuideAi = recovery?.priceGuideAi;
  const priceGuideAiReady =
    priceGuideAi?.enabled === true &&
    priceGuideAi?.featureSetting === "true" &&
    priceGuideAi?.apiKeyPresent === true &&
    priceGuideAi?.modelSupported === true &&
    priceGuideAi?.status === "PASS";
  expectBlocker(!priceGuideAiReady, /AI photo price-guide/i, "AI photo price-guide");

  expectBlocker(
    recovery?.media?.objectRecovery?.configured !== true,
    /media object retention\/recovery configuration|media object recovery/i,
    "media object recovery",
  );
  const mediaRestorePassed = validateRestoreDrill("production media", recovery?.media?.restoreDrill).length === 0;
  expectBlocker(!mediaRestorePassed, /production media restore drill/i, "media restore drill");

  for (const target of ["web", "mobile"]) {
    const alerting = observability?.projects?.[target]?.alerting;
    const alertingVerified =
      alerting?.status === "VERIFIED" &&
      alerting.destinationConfigured === true &&
      alerting.testDelivery === "PASS";
    expectBlocker(!alertingVerified, new RegExp(`production ${target} error-alert`, "i"), `${target} error alert`);
  }

  const tenantFixture = tenantIsolation?.developmentFixture;
  const tenantIsolationPassed = tenantFixture?.status === "PASS" && tenantFixture?.cleanupResidue === 0;
  expectBlocker(!tenantIsolationPassed, /development cross-tenant fixture/i, "development tenant isolation");

  expectBlocker(releaseInCurrentMaster !== true, /production release.*(?:not|outside|unverified)|not verified as part of/i, "release ancestry");
  expectBlocker(releaseSchemaAligned !== true, /production release migration|release schema/i, "release schema alignment");

  const expectedStatus = blockers.length === 0 ? "PASS" : "BLOCKED";
  if (snapshot.status !== expectedStatus) {
    failures.push("production launch summary status does not match its recorded blockers");
  }

  return failures;
}

module.exports = { validateLaunchReadbackConsistency };
