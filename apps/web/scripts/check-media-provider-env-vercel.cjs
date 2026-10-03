const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { createTemporaryEnvFile, removeTemporaryEnvFile } = require("./lib/temporary-env-file.cjs");

const root = path.resolve(__dirname, "../../..");
const manifestPath = path.join(root, "docs/operations/vercel-project-targets.json");
const projects = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const scopeId = process.env.PETMANAGER_VERCEL_SCOPE_ID || "team_049eK6zsAwMJwZnQjREjDc6X";
const argumentsSet = new Set(process.argv.slice(2));
const pullProduction = argumentsSet.has("--pull-vercel-production");
const explicitPaths = Object.fromEntries(
  ["web", "mobile"].map((target) => [
    target,
    process.argv.find((argument) => argument.startsWith(`--${target}-production=`))?.slice(`--${target}-production=`.length),
  ]),
);

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 0) continue;
    const key = trimmed.slice(0, separator).trim();
    const raw = trimmed.slice(separator + 1).trim();
    values[key] =
      (raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))
        ? raw.slice(1, -1)
        : raw;
  }
  return values;
}

function classifyMediaProvider(values) {
  const configured = (values.MEDIA_STORAGE_PROVIDER || "").trim().toLowerCase();
  const supported = configured === "r2" || configured === "supabase" || configured === "";
  const r2Requested = configured === "r2" || configured === "";
  const r2CredentialsComplete = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY"]
    .every((key) => Boolean((values[key] || "").trim()));
  const endpoint = (values.R2_ENDPOINT || "").trim();
  let endpointHttps = true;
  if (endpoint) {
    try {
      endpointHttps = new URL(endpoint).protocol === "https:";
    } catch {
      endpointHttps = false;
    }
  }
  const effectiveProvider = configured === "supabase"
    ? "supabase"
    : (r2Requested && r2CredentialsComplete ? "r2" : "supabase");

  let status = "PASS";
  if (!supported) status = "UNSUPPORTED_PROVIDER";
  else if (configured === "supabase") status = "PRODUCTION_SUPABASE_FORBIDDEN";
  else if (r2Requested && !r2CredentialsComplete) status = "R2_CREDENTIALS_INCOMPLETE";
  else if (effectiveProvider === "r2" && !endpointHttps) status = "R2_ENDPOINT_NOT_HTTPS";

  return {
    configuredProvider: supported ? (configured || "unset") : "unsupported",
    effectiveProvider,
    r2CredentialsComplete,
    bucketConfigured: Boolean((values.R2_BUCKET || "").trim()),
    endpointConfigured: Boolean(endpoint),
    endpointHttps,
    status,
  };
}

function pullProductionEnv(target, filePath) {
  const project = projects[target];
  const cwd = path.resolve(root, project.rootDirectory);
  if (process.platform === "win32") {
    const escapedPath = filePath.replace(/"/g, '\\"');
    const escapedScope = scopeId.replace(/"/g, '\\"');
    const escapedProject = project.projectId.replace(/"/g, '\\"');
    execSync(
      `npx.cmd vercel env pull "${escapedPath}" --environment=production --yes --scope "${escapedScope}" --project "${escapedProject}"`,
      { cwd, stdio: "ignore", windowsHide: true },
    );
    return;
  }
  execFileSync(
    "npx",
    ["vercel", "env", "pull", filePath, "--environment=production", "--yes", "--scope", scopeId, "--project", project.projectId],
    { cwd, stdio: "ignore", windowsHide: true },
  );
}

function main() {
  if (pullProduction && Object.values(explicitPaths).some(Boolean)) {
    console.error("ERROR: explicit env files cannot be combined with --pull-vercel-production.");
    process.exitCode = 1;
    return;
  }
  if (!pullProduction && Object.values(explicitPaths).some((file) => !file)) {
    console.error("Usage: node check-media-provider-env-vercel.cjs --pull-vercel-production | --web-production=<file> --mobile-production=<file>");
    process.exitCode = 1;
    return;
  }

  let failed = false;
  for (const target of ["web", "mobile"]) {
    const temporary = pullProduction ? createTemporaryEnvFile(`petmanager-media-${target}`) : null;
    const filePath = temporary?.file || path.resolve(explicitPaths[target]);
    let values = null;
    try {
      if (pullProduction) pullProductionEnv(target, filePath);
      values = parseEnvFile(filePath);
      if (!values) {
        failed = true;
        console.log(`ERROR ${projects[target].projectName}: production env readback unavailable`);
        continue;
      }
      const result = classifyMediaProvider(values);
      const ok = result.status === "PASS";
      failed ||= !ok;
      console.log(
        `${ok ? "OK" : "ERROR"} ${projects[target].projectName}: configured=${result.configuredProvider}, effective=${result.effectiveProvider}, R2 credentials=${result.r2CredentialsComplete ? "complete" : "incomplete"}, bucket=${result.bucketConfigured ? "configured" : "default"}, endpoint=${result.endpointConfigured ? (result.endpointHttps ? "HTTPS" : "not HTTPS") : "default"}${ok ? "" : ` (${result.status})`}`,
      );
    } catch {
      failed = true;
      console.log(`ERROR ${projects[target].projectName}: production env readback failed`);
    } finally {
      if (values) {
        for (const key of Object.keys(values)) values[key] = "";
      }
      removeTemporaryEnvFile(temporary);
    }
  }
  if (failed) process.exitCode = 1;
}

if (require.main === module) main();

module.exports = { classifyMediaProvider };
