const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const npxCommand = process.platform === "win32" ? "D:\\Node\\node.exe" : "npx";
const npxPrefixArgs = process.platform === "win32" ? ["D:\\Node\\node_modules\\npm\\bin\\npx-cli.js"] : [];
const envFile = process.argv.find((arg) => arg.startsWith("--local="))?.slice("--local=".length) || ".env.local";
const targetEnvironment = process.argv.find((arg) => arg.startsWith("--environment="))?.slice("--environment=".length) || "production";
const removeEmpty = process.argv.includes("--remove-empty");
const dryRun = process.argv.includes("--dry-run");
const onlyTemplates = process.argv.includes("--only-templates");
const approval = process.env.PETMANAGER_VERCEL_ENV_CONFIRMATION || "";
const changeReason = (process.env.PETMANAGER_VERCEL_ENV_CHANGE_REASON || "").trim();
const projectId = process.env.PETMANAGER_VERCEL_PROJECT_ID || "prj_v3zjDSALc0VTY3yLRaNO5Il43uwO";
const scopeId = process.env.PETMANAGER_VERCEL_SCOPE_ID || "team_049eK6zsAwMJwZnQjREjDc6X";

const keys = [
  "ALIMTALK_SENDER_KEY",
  "ALIMTALK_RELAY_URL",
  "ALIMTALK_RELAY_ADMIN_URL",
  "ALIMTALK_RELAY_SECRET",
  "ALIMTALK_TEMPLATE_BOOKING_RECEIVED",
  "ALIMTALK_TEMPLATE_BOOKING_CONFIRMED",
  "ALIMTALK_TEMPLATE_BOOKING_REJECTED",
  "ALIMTALK_TEMPLATE_BOOKING_CANCELLED",
  "ALIMTALK_TEMPLATE_BOOKING_TIME_PROPOSED",
  "ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED",
  "ALIMTALK_TEMPLATE_BOOKING_MANAGE_LINK_REQUESTED",
  "ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M",
  "ALIMTALK_TEMPLATE_VISIT_SCHEDULE_NOTICE",
  "ALIMTALK_TEMPLATE_VISIT_REMINDER_NOTICE",
  "ALIMTALK_TEMPLATE_GROOMING_STARTED",
  "ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE",
  "ALIMTALK_TEMPLATE_GROOMING_COMPLETED",
  "ALIMTALK_TEMPLATE_GROOMING_COMPLETED_WITHOUT_REPORT",
  "ALIMTALK_TEMPLATE_REVISIT_NOTICE",
  "ALIMTALK_TEMPLATE_BIRTHDAY_GREETING",
];

const sensitiveKeys = new Set(["ALIMTALK_SENDER_KEY", "ALIMTALK_RELAY_SECRET"]);

function parseEnv(filePath) {
  const values = {};
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 0) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function runVercel(args, options = {}) {
  const result = spawnSync(npxCommand, [...npxPrefixArgs, "vercel", ...args], {
    input: options.input,
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
  });

  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || result.error?.message || "",
  };
}

function projectArgs() {
  return ["--scope", scopeId, "--project", projectId];
}

function assertApprovedWrite() {
  if (dryRun) return;
  if (approval !== targetEnvironment) {
    throw new Error(
      `Refusing Vercel ${targetEnvironment} env write. Set PETMANAGER_VERCEL_ENV_CONFIRMATION=${targetEnvironment} only after explicit approval.`,
    );
  }
  if (changeReason.length < 10) {
    throw new Error(
      "Refusing Vercel env write. Set PETMANAGER_VERCEL_ENV_CHANGE_REASON with a concrete reason (10+ characters).",
    );
  }
}

assertApprovedWrite();

const envValues = parseEnv(envFile);
const changed = [];
const removed = [];
const skipped = [];

const syncKeys = onlyTemplates ? keys.filter((key) => key.startsWith("ALIMTALK_TEMPLATE_")) : keys;

for (const key of syncKeys) {
  const value = envValues[key] || "";
  if (!value) {
    if (!removeEmpty) {
      skipped.push(key);
      continue;
    }

    if (dryRun) {
      removed.push(key);
      continue;
    }

    const removeResult = runVercel(["env", "rm", key, targetEnvironment, "--yes", ...projectArgs()]);
    if (
      !removeResult.ok &&
      !/not found|does not exist|no environment variable/i.test(`${removeResult.stdout}\n${removeResult.stderr}`)
    ) {
      console.error(`ERROR ${key}: failed to remove from Vercel ${targetEnvironment}`);
      console.error(removeResult.stderr.split(/\r?\n/).filter(Boolean).slice(-2).join("\n"));
      process.exitCode = 1;
      break;
    }

    removed.push(key);
    continue;
  }

  if (dryRun) {
    changed.push(`${key}(${value.length})`);
    continue;
  }

  const sensitivityFlag = sensitiveKeys.has(key) ? "--sensitive" : "--no-sensitive";
  const addResult = runVercel([
    "env",
    "add",
    key,
    targetEnvironment,
    "--value",
    value,
    "--yes",
    "--force",
    sensitivityFlag,
    ...projectArgs(),
  ]);

  if (!addResult.ok) {
    console.error(`ERROR ${key}: failed to set in Vercel ${targetEnvironment}`);
    console.error(addResult.stderr.split(/\r?\n/).filter(Boolean).slice(-2).join("\n"));
    process.exitCode = 1;
    break;
  }

  changed.push(`${key}(${value.length})`);
}

console.log(`${dryRun ? "DRY_RUN" : "Synced"} ${changed.length} Alimtalk env values for Vercel ${targetEnvironment}.`);
for (const item of changed) console.log(`SET ${item}`);
for (const key of removed) console.log(`REMOVE ${key}`);
for (const key of skipped) console.log(`SKIP ${key}: empty locally`);
