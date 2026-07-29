const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const args = process.argv.slice(2);
const command = args.find((arg) => !arg.startsWith("--")) || "check";
const profileName = args.filter((arg) => !arg.startsWith("--"))[1] || "neomchin";
const sharedEnvPath =
  args.find((arg) => arg.startsWith("--shared="))?.slice("--shared=".length) ||
  "D:\\petmanager-shared\\env\\petmanager.env.local";
const localEnvPath =
  args.find((arg) => arg.startsWith("--local="))?.slice("--local=".length) ||
  path.join(rootDir, ".env.local");

const TEMPLATE_KEYS = [
  "ALIMTALK_TEMPLATE_BOOKING_RECEIVED",
  "ALIMTALK_TEMPLATE_BOOKING_CONFIRMED",
  "ALIMTALK_TEMPLATE_BOOKING_REJECTED",
  "ALIMTALK_TEMPLATE_BOOKING_CANCELLED",
  "ALIMTALK_TEMPLATE_BOOKING_TIME_PROPOSED",
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

const profiles = {
  neomchin: {
    label: "넘친데이 펫매니저",
    stagedSenderKey: "ALIMTALK_NEOMCHIN_SENDER_KEY",
    templates: {
      ALIMTALK_TEMPLATE_BOOKING_CONFIRMED: "booking_confirmed_v1",
      ALIMTALK_TEMPLATE_BOOKING_CANCELLED: "booking_cancelled_v3_1",
      ALIMTALK_TEMPLATE_BOOKING_TIME_PROPOSED: "booking_rejected_v2",
      ALIMTALK_TEMPLATE_BOOKING_RESCHEDULED_CONFIRMED: "B_rescheduled_confirmed_v2",
      ALIMTALK_TEMPLATE_APPOINTMENT_REMINDER_10M: "booking_soon_notice_v1",
      ALIMTALK_TEMPLATE_VISIT_SCHEDULE_NOTICE: "booking_tomorrow_notice_v1",
      ALIMTALK_TEMPLATE_VISIT_REMINDER_NOTICE: "booking_today_notice_v1",
      ALIMTALK_TEMPLATE_GROOMING_STARTED: "grooming_started_v3",
      ALIMTALK_TEMPLATE_GROOMING_ALMOST_DONE: "grooming_almost_done_v2",
      ALIMTALK_TEMPLATE_GROOMING_COMPLETED: "grooming_completed_V2",
    },
  },
};

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Env file not found: ${filePath}`);
  }

  const values = new Map();
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values.set(key, value);
  }
  return values;
}

function updateEnvFile(filePath, updates) {
  const original = fs.readFileSync(filePath, "utf8");
  const newline = original.includes("\r\n") ? "\r\n" : "\n";
  const seen = new Set();
  const lines = original.split(/\r?\n/).map((line) => {
    const separatorIndex = line.indexOf("=");
    if (separatorIndex < 1 || line.trimStart().startsWith("#")) return line;

    const key = line.slice(0, separatorIndex).trim();
    if (!updates.has(key)) return line;

    seen.add(key);
    return `${key}=${updates.get(key)}`;
  });

  while (lines.length > 0 && lines.at(-1) === "") lines.pop();
  for (const [key, value] of updates) {
    if (!seen.has(key)) lines.push(`${key}=${value}`);
  }

  fs.writeFileSync(filePath, `${lines.join(newline)}${newline}`, "utf8");
}

function requiredOption(name) {
  const prefix = `--${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();
  if (!value) throw new Error(`Missing required option: ${prefix}<value>`);
  return value;
}

function assertProfile() {
  const profile = profiles[profileName];
  if (!profile) throw new Error(`Unknown Alimtalk profile: ${profileName}`);
  return profile;
}

function assertStagedSender(profile, sharedEnv, localEnv) {
  const sharedSender = sharedEnv.get(profile.stagedSenderKey) || "";
  const localSender = localEnv.get(profile.stagedSenderKey) || "";
  if (!sharedSender || !localSender) {
    throw new Error(`${profile.stagedSenderKey} must be present in both shared and local env files.`);
  }
  if (sharedSender !== localSender) {
    throw new Error(`${profile.stagedSenderKey} differs between shared and local env files.`);
  }
  return sharedSender;
}

function checkProfile(profile) {
  const sharedEnv = parseEnv(sharedEnvPath);
  const localEnv = parseEnv(localEnvPath);
  const stagedSender = assertStagedSender(profile, sharedEnv, localEnv);
  const activeSender = sharedEnv.get("ALIMTALK_SENDER_KEY") || "";
  const active = activeSender === stagedSender;
  const templateDifferences = TEMPLATE_KEYS.filter(
    (key) => (sharedEnv.get(key) || "") !== (profile.templates[key] || ""),
  );
  const localDifferences = [
    "ALIMTALK_SENDER_KEY",
    profile.stagedSenderKey,
    ...TEMPLATE_KEYS,
  ].filter((key) => (sharedEnv.get(key) || "") !== (localEnv.get(key) || ""));

  console.log(`profile=${profileName}`);
  console.log(`label=${profile.label}`);
  console.log(`stagedSender=present(${stagedSender.length})`);
  console.log(`active=${active}`);
  console.log(`configuredTemplates=${Object.keys(profile.templates).length}`);
  console.log(`activeTemplateDifferences=${templateDifferences.length}`);
  console.log(`sharedLocalDifferences=${localDifferences.length}`);
  console.log("providerReviewStatus=external-check-required");

  if (localDifferences.length > 0) {
    console.error(`Shared/local env differences: ${localDifferences.join(", ")}`);
    process.exitCode = 1;
  }
}

function stageProfile(profile) {
  const senderKey = requiredOption("sender-key");
  const updates = new Map([[profile.stagedSenderKey, senderKey]]);

  updateEnvFile(sharedEnvPath, updates);
  updateEnvFile(localEnvPath, updates);

  console.log(`Staged ${profile.label} sender profile in shared and local env files.`);
  console.log(`${profile.stagedSenderKey}=set(${senderKey.length})`);
  console.log(`configuredTemplates=${Object.keys(profile.templates).length}`);
  console.log("activeProfileChanged=false");
}

function activateProfile(profile) {
  if (!args.includes("--approved")) {
    throw new Error("Refusing to activate an unverified profile. Re-run with --approved after every template is approved.");
  }

  const sharedEnv = parseEnv(sharedEnvPath);
  const localEnv = parseEnv(localEnvPath);
  const senderKey = assertStagedSender(profile, sharedEnv, localEnv);
  const updates = new Map([["ALIMTALK_SENDER_KEY", senderKey]]);

  for (const key of TEMPLATE_KEYS) {
    updates.set(key, profile.templates[key] || "");
  }

  updateEnvFile(sharedEnvPath, updates);
  updateEnvFile(localEnvPath, updates);

  console.log(`Activated ${profile.label} in shared and local env files.`);
  console.log(`ALIMTALK_SENDER_KEY=set(${senderKey.length})`);
  console.log(`activeTemplates=${Object.keys(profile.templates).length}`);
  console.log(`disabledTemplates=${TEMPLATE_KEYS.length - Object.keys(profile.templates).length}`);
  console.log("NEXT: npm run sync:alimtalk-relay-env");
  console.log("NEXT: npm run sync:alimtalk-env:vercel -- --remove-empty");
  console.log("NEXT: restart local Next.js and Alimtalk relay, then run diagnostics.");
}

try {
  const profile = assertProfile();
  if (command === "check") {
    checkProfile(profile);
  } else if (command === "stage") {
    stageProfile(profile);
  } else if (command === "activate") {
    activateProfile(profile);
  } else {
    throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
