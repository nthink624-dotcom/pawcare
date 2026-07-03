const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const sharedEnvPath = "D:\\petmanager-shared\\env\\petmanager.env.local";
const localEnvPath = path.join(rootDir, ".env.local");
const relayEnvPath = path.join(rootDir, "backend", "alimtalk-relay", ".env");

const sourceEnvPath = fs.existsSync(sharedEnvPath) ? sharedEnvPath : localEnvPath;

const relayKeys = [
  "PORT",
  "RELAY_SECRET",
  "SSODAA_API_URL",
  "SSODAA_SENT_LIST_URL",
  "SSODAA_API_KEY",
  "SSODAA_TOKEN_KEY",
  "SSODAA_SENDER_KEY",
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

function parseEnv(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  const result = new Map();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalIndex = line.indexOf("=");
    if (equalIndex < 1) continue;

    const key = line.slice(0, equalIndex).trim();
    let value = line.slice(equalIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    result.set(key, value);
  }

  return result;
}

function serialize(value) {
  return JSON.stringify(String(value ?? "").replace(/\r?\n/g, " ").trim());
}

const env = parseEnv(sourceEnvPath);
const relayValues = {
  PORT: env.get("ALIMTALK_RELAY_LOCAL_PORT") || "14010",
  RELAY_SECRET: env.get("ALIMTALK_RELAY_SECRET") || "",
  SSODAA_API_URL: env.get("ALIMTALK_API_URL") || "https://apis.ssodaa.com/kakao/send/alimtalk",
  SSODAA_SENT_LIST_URL: env.get("ALIMTALK_SENT_LIST_URL") || "https://apis.ssodaa.com/kakao/alimtalk/sent/list",
  SSODAA_API_KEY: env.get("ALIMTALK_API_KEY") || "",
  SSODAA_TOKEN_KEY: env.get("ALIMTALK_TOKEN_KEY") || "",
  SSODAA_SENDER_KEY: env.get("ALIMTALK_SENDER_KEY") || "",
};

for (const key of relayKeys) {
  if (key.startsWith("ALIMTALK_TEMPLATE_")) {
    relayValues[key] = env.get(key) || "";
  }
}

const missingRequired = [
  "RELAY_SECRET",
  "SSODAA_API_KEY",
  "SSODAA_TOKEN_KEY",
  "SSODAA_SENDER_KEY",
].filter((key) => !relayValues[key]);

if (missingRequired.length > 0) {
  console.error(`Missing required relay env values in ${sourceEnvPath}: ${missingRequired.join(", ")}`);
  process.exit(1);
}

fs.mkdirSync(path.dirname(relayEnvPath), { recursive: true });
fs.writeFileSync(
  relayEnvPath,
  relayKeys.map((key) => `${key}=${serialize(relayValues[key] || "")}`).join("\n") + "\n",
  "utf8",
);

console.log(`Synced Alimtalk relay env from ${sourceEnvPath} to ${relayEnvPath}`);
for (const key of relayKeys) {
  const value = relayValues[key] || "";
  console.log(`${key}: ${value ? `set(${value.length})` : "empty"}`);
}
