const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const failures = [];

function read(relativePath) {
  const absolutePath = path.join(root, relativePath);
  if (!fs.existsSync(absolutePath)) {
    failures.push(`missing: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(absolutePath, "utf8");
}

function requireText(source, text, label) {
  if (source && !source.includes(text)) failures.push(`${label}: missing ${text}`);
}

const routeGuard = read("scripts/check-owner-tenant-route-guards.cjs");
const integrityTest = read("apps/web/tests/server/booking-payment-tenant-integrity.test.mjs");
const fixtureTest = read("apps/web/tests/server/marketing-acquisition-development-fixture-runner.test.mjs");
const fixture = read("scripts/run-development-acquisition-fixture.mjs");
const feedbackFixture = read("scripts/run-development-tester-feedback-fixture.mjs");

requireText(routeGuard, "requireOwnerShop", "owner route authorization scan");
requireText(routeGuard, "assertOwnerOrManager", "manager route authorization scan");
requireText(integrityTest, "atomic booking rejects cross-shop relations", "database cross-shop integrity contract");
requireText(integrityTest, "appointments_guardian_shop_tenant_fk", "appointment tenant foreign key contract");
requireText(integrityTest, "notifications_assert_tenant_integrity", "notification tenant trigger contract");
requireText(integrityTest, "media_assets_assert_tenant_integrity", "media tenant trigger contract");
requireText(fixtureTest, "pm-acq-r9-foreign-", "development fixture foreign-tenant case");
requireText(fixtureTest, "tenant_denial_failed", "development fixture denial assertion");
requireText(fixtureTest, "cleanupResidue: 0", "development fixture cleanup assertion");
requireText(fixture, "assertDevelopmentTarget", "development-only fixture target guard");
requireText(fixture, "EXPECTED_DEVELOPMENT_PROJECT_REF", "development project ref guard");
requireText(fixture, "verifyResidueZero", "development fixture residue verification");
requireText(feedbackFixture, "PM_TESTER_FEEDBACK_MEMBER_REQUIRED", "tester feedback tenant denial contract");
requireText(feedbackFixture, "foreignShopId", "tester feedback foreign tenant fixture");

if (failures.length > 0) {
  console.error("Tenant isolation contract check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Tenant isolation contract check: PASS");
console.log("WARN: Cross-tenant development fixtures are defined but were not executed; they require protected development credentials and perform temporary database writes.");
