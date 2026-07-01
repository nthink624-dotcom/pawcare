const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const TEMPLATE_KEYS = [
  "ALIMTALK_TEMPLATE_BOOKING_RECEIVED",
  "ALIMTALK_TEMPLATE_BOOKING_CONFIRMED",
  "ALIMTALK_TEMPLATE_BOOKING_REJECTED",
  "ALIMTALK_TEMPLATE_BOOKING_CANCELLED",
  "ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED",
  "ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M",
  "ALIMTALK_TEMPLATE_VISIT_SCHEDULE_NOTICE",
  "ALIMTALK_TEMPLATE_VISIT_REMINDER_NOTICE",
  "ALIMTALK_TEMPLATE_GROOMING_STARTED",
  "ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE",
  "ALIMTALK_TEMPLATE_GROOMING_COMPLETED",
  "ALIMTALK_TEMPLATE_REVISIT_NOTICE",
  "ALIMTALK_TEMPLATE_BIRTHDAY_GREETING",
];

const RELAY_KEYS = ["ALIMTALK_RELAY_URL", "ALIMTALK_RELAY_ADMIN_URL", "ALIMTALK_RELAY_SECRET"];
const SENSITIVE_PULL_KEYS = new Set(["ALIMTALK_RELAY_SECRET"]);
const args = new Set(process.argv.slice(2));
const shouldPullVercel = args.has("--pull-vercel-production");
const localEnvFile = process.argv.find((arg) => arg.startsWith("--local="))?.slice("--local=".length) || ".env.local";
const productionEnvFile =
  process.argv.find((arg) => arg.startsWith("--production="))?.slice("--production=".length) ||
  (shouldPullVercel ? ".tmp-alimtalk-vercel-production.env" : ".env.vercel-production.local");

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const values = {};
  fs.readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return;

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex < 0) return;

      const key = trimmed.slice(0, separatorIndex).trim();
      const rawValue = trimmed.slice(separatorIndex + 1).trim();
      const value =
        (rawValue.startsWith('"') && rawValue.endsWith('"')) || (rawValue.startsWith("'") && rawValue.endsWith("'"))
          ? rawValue.slice(1, -1)
          : rawValue;

      values[key] = value;
    });

  return values;
}

function valueStatus(key, localValue, productionValue) {
  if (SENSITIVE_PULL_KEYS.has(key) && localValue && !productionValue) return "present-sensitive";
  if (!localValue && !productionValue) return "both-missing";
  if (!localValue) return "local-missing";
  if (!productionValue) return "production-missing";
  if (localValue === productionValue) return "same";
  return "different";
}

function printGroup(title, keys, localValues, productionValues) {
  console.log(`\n[${title}]`);
  let hasIssue = false;

  keys.forEach((key) => {
    const status = valueStatus(key, localValues[key], productionValues[key]);
    const isIssue = status !== "same" && status !== "both-missing" && status !== "present-sensitive";
    hasIssue ||= isIssue;
    console.log(`${isIssue ? "ERROR" : "OK"} ${key}: ${status}`);
  });

  return hasIssue;
}

function pullVercelProductionEnv(targetFile) {
  try {
    if (process.platform === "win32") {
      const escapedTarget = targetFile.replace(/"/g, '\\"');
      execSync(`npx.cmd vercel env pull "${escapedTarget}" --environment=production --yes`, { stdio: "ignore" });
      return;
    }

    execFileSync("npx", ["vercel", "env", "pull", targetFile, "--environment=production", "--yes"], {
      stdio: "ignore",
    });
  } catch (error) {
    throw new Error(`Vercel production env pull failed: ${error.message}`);
  }
}

if (shouldPullVercel) {
  pullVercelProductionEnv(productionEnvFile);
}

try {
  const localValues = parseEnvFile(localEnvFile);
  const productionValues = parseEnvFile(productionEnvFile);

  if (!localValues) {
    console.error(`ERROR: local env file not found: ${localEnvFile}`);
    process.exitCode = 1;
    return;
  }

  if (!productionValues) {
    console.error(`ERROR: production env file not found: ${productionEnvFile}`);
    process.exitCode = 1;
    return;
  }

  console.log(`local=${path.normalize(localEnvFile)}`);
  console.log(`production=${path.normalize(productionEnvFile)}`);

  const relayHasIssue = printGroup("Relay", RELAY_KEYS, localValues, productionValues);
  const templateHasIssue = printGroup("Alimtalk Templates", TEMPLATE_KEYS, localValues, productionValues);

  if (relayHasIssue || templateHasIssue) {
    console.error(
      "\nAlimtalk relay/template values must stay identical between local development and Vercel production.",
    );
    process.exitCode = 1;
  }
} finally {
  if (shouldPullVercel && fs.existsSync(productionEnvFile)) {
    fs.unlinkSync(productionEnvFile);
  }
}
