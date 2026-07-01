const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const npxCommand = process.platform === "win32" ? "D:\\Node\\node.exe" : "npx";
const npxPrefixArgs = process.platform === "win32" ? ["D:\\Node\\node_modules\\npm\\bin\\npx-cli.js"] : [];
const envFile = process.argv.find((arg) => arg.startsWith("--local="))?.slice("--local=".length) || ".env.local";
const targetEnvironment = process.argv.find((arg) => arg.startsWith("--environment="))?.slice("--environment=".length) || "production";

const keys = [
  "ALIMTALK_RELAY_URL",
  "ALIMTALK_RELAY_ADMIN_URL",
  "ALIMTALK_RELAY_SECRET",
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

const sensitiveKeys = new Set(["ALIMTALK_RELAY_SECRET"]);

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

const envValues = parseEnv(envFile);
const changed = [];
const skipped = [];

for (const key of keys) {
  const value = envValues[key] || "";
  if (!value) {
    skipped.push(key);
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
  ]);

  if (!addResult.ok) {
    console.error(`ERROR ${key}: failed to set in Vercel ${targetEnvironment}`);
    console.error(addResult.stderr.split(/\r?\n/).filter(Boolean).slice(-2).join("\n"));
    process.exitCode = 1;
    break;
  }

  changed.push(`${key}(${value.length})`);
}

console.log(`Synced ${changed.length} Alimtalk env values to Vercel ${targetEnvironment}.`);
for (const item of changed) console.log(`SET ${item}`);
for (const key of skipped) console.log(`SKIP ${key}: empty locally`);
