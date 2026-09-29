const { execFileSync, execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const args = new Set(process.argv.slice(2));
const shouldPullVercel = args.has("--pull-vercel-production");
const productionEnvFile =
  process.argv.find((arg) => arg.startsWith("--production="))?.slice("--production=".length) ||
  ".tmp-payment-vercel-production.env";
const vercelProjectId = process.env.PETMANAGER_VERCEL_PROJECT_ID || "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO";
const vercelScopeId = process.env.PETMANAGER_VERCEL_SCOPE_ID || "team_049eK6zsAwMJwZnQjREjDc6X";

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const values = {};
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex < 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    values[key] =
      (rawValue.startsWith('"') && rawValue.endsWith('"')) ||
      (rawValue.startsWith("'") && rawValue.endsWith("'"))
        ? rawValue.slice(1, -1)
        : rawValue;
  }
  return values;
}

function pullVercelProductionEnv(targetFile) {
  try {
    if (process.platform === "win32") {
      const escapedTarget = targetFile.replace(/"/g, '\\"');
      execSync(`npx.cmd vercel env pull "${escapedTarget}" --environment=production --yes --scope "${vercelScopeId}" --project "${vercelProjectId}"`, {
        cwd: path.resolve(__dirname, ".."),
        stdio: "ignore",
      });
      return;
    }
    execFileSync("npx", ["vercel", "env", "pull", targetFile, "--environment=production", "--yes", "--scope", vercelScopeId, "--project", vercelProjectId], {
      cwd: path.resolve(__dirname, ".."),
      stdio: "ignore",
    });
  } catch (error) {
    throw new Error(`Vercel production env pull failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function present(values, keys) {
  return keys.some((key) => typeof values[key] === "string" && values[key].trim().length > 0);
}

if (shouldPullVercel) pullVercelProductionEnv(productionEnvFile);

try {
  const productionValues = parseEnvFile(productionEnvFile);
  if (!productionValues) {
    console.error(`ERROR: production env file not found: ${productionEnvFile}`);
    process.exitCode = 1;
    return;
  }

  const checks = [
    ["PORTONE_API_SECRET", ["PORTONE_API_SECRET"]],
    ["PORTONE_WEBHOOK_SECRET", ["PORTONE_WEBHOOK_SECRET"]],
    ["BILLING_KEY_ENCRYPTION_SECRET", ["BILLING_KEY_ENCRYPTION_SECRET"]],
    ["PORTONE_STORE_ID", ["PORTONE_STORE_ID", "NEXT_PUBLIC_PORTONE_STORE_ID"]],
    ["PORTONE_BILLING_CHANNEL_KEY", ["PORTONE_BILLING_CHANNEL_KEY", "NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY"]],
    ["PORTONE_PAYMENT_CHANNEL_KEY", ["PORTONE_PAYMENT_CHANNEL_KEY", "NEXT_PUBLIC_PORTONE_PAYMENT_CHANNEL_KEY"]],
  ];

  console.log(`production=${path.normalize(productionEnvFile)}`);
  let failed = false;
  for (const [label, keys] of checks) {
    const ok = present(productionValues, keys);
    failed ||= !ok;
    console.log(`${ok ? "OK" : "ERROR"} ${label}: ${ok ? "present" : `missing (${keys.join(" or ")})`}`);
  }

  if (failed) {
    console.error("\nPortOne production environment is incomplete for payment and recurring billing operations.");
    process.exitCode = 1;
  }
} finally {
  if (shouldPullVercel && fs.existsSync(productionEnvFile)) fs.unlinkSync(productionEnvFile);
}
