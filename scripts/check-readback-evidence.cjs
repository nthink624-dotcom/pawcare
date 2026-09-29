const fs = require("node:fs");
const path = require("node:path");

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
const supabase = readJson("docs/operations/supabase-readonly-readback-20260929.json");
const vercel = readJson("docs/operations/vercel-readonly-readback-20260929.json");

const isReadbackDate = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
if (!isReadbackDate(supabase?.readAt) || !isReadbackDate(vercel?.readAt)) {
  failures.push("readback evidence must include an ISO calendar readAt date");
} else if (supabase.readAt !== vercel.readAt) {
  failures.push("Supabase and Vercel readback dates must match");
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

if (failures.length > 0) {
  console.error("Readback evidence check: BLOCKED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Readback evidence check: PASS (structure and target identity verified)");
for (const warning of warnings) console.log(`WARN: ${warning}`);
