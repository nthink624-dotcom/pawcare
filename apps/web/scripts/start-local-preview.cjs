const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const {
  PREVIEW_DIST_ENV,
  acquireBuildGenerationLock,
  snapshotBuildGeneration,
} = require("./local-preview-generation.cjs");

const projectRoot = path.resolve(__dirname, "..");
const lock = acquireBuildGenerationLock({ projectRoot });
let generation;

try {
  generation = snapshotBuildGeneration({ projectRoot });
} finally {
  lock.release();
}

const nextBin = require.resolve("next/dist/bin/next");
const port = String(process.env.PLAYWRIGHT_PORT || process.env.PETMANAGER_LOCAL_PORT || "3000");
const LOOPBACK_HOSTNAMES = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);
const TRANSPORT_ENV_KEYS = ["ALIMTALK_API_URL", "ALIMTALK_RELAY_URL", "ALIMTALK_RELAY_ADMIN_URL"];

function readLocalEnvValue(source, key) {
  const line = source.match(new RegExp(`^${key}=(.*)$`, "m"));
  if (!line) return undefined;
  return line[1].trim().replace(/^(?:"([\\s\\S]*)"|'([\\s\\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
}

function normalizeLocalLoopbackTransportEnv(env) {
  const localEnvPath = path.join(projectRoot, ".env.local");
  const localEnvSource = fs.existsSync(localEnvPath) ? fs.readFileSync(localEnvPath, "utf8") : "";
  const normalizedKeys = [];

  for (const key of TRANSPORT_ENV_KEYS) {
    const value = (env[key] ?? readLocalEnvValue(localEnvSource, key))?.trim();
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (parsed.protocol === "http:" && LOOPBACK_HOSTNAMES.has(parsed.hostname.toLowerCase())) {
        parsed.protocol = "https:";
        env[key] = parsed.toString();
        normalizedKeys.push(key);
      }
    } catch {
      // Let the normal server-environment validation report malformed values.
    }
  }

  if (normalizedKeys.length > 0) {
    console.log(`Local preview uses HTTPS loopback placeholders for: ${normalizedKeys.join(", ")}`);
  }
}

const previewEnv = { ...process.env, [PREVIEW_DIST_ENV]: generation.distDir };
normalizeLocalLoopbackTransportEnv(previewEnv);
const child = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", port], {
  cwd: projectRoot,
  env: previewEnv,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
