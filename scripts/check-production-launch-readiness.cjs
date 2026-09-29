const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

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
  [path.join(root, "scripts/check-production-endpoints.cjs"), "--expected-release", expectedRelease],
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

function readJson(relativePath) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
  } catch {
    failures.push(`missing or invalid readback: ${relativePath}`);
    return null;
  }
}

const supabase = readJson("docs/operations/supabase-readonly-readback-20260929.json");
const vercel = readJson("docs/operations/vercel-readonly-readback-20260929.json");
const productionSecurity = supabase?.projects?.production?.securityAdvisors ?? {};
const productionRls = supabase?.projects?.production?.publicTableRlsReadback ?? {};
if (productionSecurity.auth_leaked_password_protection?.level === "WARN") {
  failures.push("production Supabase leaked-password protection is still WARN");
}
if (!Number.isInteger(productionRls.tableCount) || !Number.isInteger(productionRls.tablesWithoutRls) || !Number.isInteger(productionRls.tablesWithoutPolicies)) {
  failures.push("production Supabase RLS metadata readback is missing or incomplete");
}
if (Number.isInteger(productionRls.tablesWithoutRls) && productionRls.tablesWithoutRls > 0) {
  failures.push(`production Supabase has ${productionRls.tablesWithoutRls} public tables without RLS`);
}
if (Number.isInteger(productionRls.tablesWithoutPolicies) && productionRls.tablesWithoutPolicies > 0) {
  failures.push(`production Supabase has ${productionRls.tablesWithoutPolicies} RLS-enabled public tables without policies`);
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
for (const target of ["web", "mobile"]) {
  const smoke = vercel?.projects?.[target]?.endpointSmoke;
  if (smoke?.healthz !== 200 || smoke?.readyz !== 200) failures.push(`${target} readback endpoint smoke is not 200/200`);
}

if (failures.length > 0) {
  console.error("Production launch gate: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Production launch gate: PASS (${expectedRelease})`);
