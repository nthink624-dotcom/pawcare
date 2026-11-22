const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { pathToFileURL } = require("node:url");
const { spawn, spawnSync } = require("node:child_process");

const appRoot = path.resolve(__dirname, "..");
const relayRoot = path.resolve(appRoot, "../../backend/alimtalk-relay");
const envPath = path.join(appRoot, ".env.local");

function parseEnv(text) {
  return Object.fromEntries(text.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
    return match ? [[match[1], match[2].trim().replace(/^(['"])(.*)\1$/, "$2")]] : [];
  }));
}

function validateLocalEnvironment(values) {
  const database = new URL(values.NEXT_PUBLIC_SUPABASE_URL || "");
  if (database.origin !== "https://qefxdtmdtvnzgupmjlom.supabase.co" || database.username || database.password || database.pathname !== "/" || database.search || database.hash || values.ALLOW_PROD_SUPABASE_IN_DEV === "true") {
    throw new Error("Local AlimTalk requires the approved development database; production access is not allowed.");
  }
  if (values.ALIMTALK_PROVIDER !== "ssodaa") throw new Error("Local AlimTalk provider configuration is missing.");
  if (values.ALIMTALK_RELAY_ACCESS_MODE && values.ALIMTALK_RELAY_ACCESS_MODE !== "read-only") {
    throw new Error("Local AlimTalk must use read-only access mode.");
  }
  const port = Number(values.ALIMTALK_RELAY_LOCAL_PORT || 14010);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Invalid local relay port.");
  for (const key of ["ALIMTALK_RELAY_URL", "ALIMTALK_RELAY_ADMIN_URL"]) {
    const url = new URL(values[key] || "");
    if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || Number(url.port) !== port || url.pathname !== "/alimtalk/send" || url.username || url.password || url.search || url.hash) {
      throw new Error(`${key} must point to the configured loopback relay, not a shared or production server.`);
    }
  }
  for (const key of ["ALIMTALK_API_KEY", "ALIMTALK_TOKEN_KEY", "ALIMTALK_SENDER_KEY"]) {
    if (!values[key]) throw new Error(`${key} is missing.`);
  }
  return { port, origin: `http://127.0.0.1:${port}` };
}

function assertOutsideOneDrive(directory) {
  let ancestor = path.resolve(directory);
  const suffix = [];
  while (!fs.existsSync(ancestor)) {
    suffix.unshift(path.basename(ancestor));
    ancestor = path.dirname(ancestor);
  }
  const physical = path.join(fs.realpathSync(ancestor), ...suffix).toLowerCase();
  const roots = [process.env.OneDrive, process.env.OneDriveConsumer, process.env.OneDriveCommercial, "D:\\OneDrive"].filter(Boolean);
  for (const root of roots) {
    const resolved = (fs.existsSync(root) ? fs.realpathSync(root) : path.resolve(root)).toLowerCase();
    if (physical === resolved || physical.startsWith(resolved + path.sep)) throw new Error("Local runtime outputs must stay outside OneDrive.");
  }
}

function setEnvValue(text, key, value) {
  const pattern = new RegExp(`^${key}=.*$`, "m");
  return pattern.test(text) ? text.replace(pattern, `${key}=${value}`) : text.replace(/\s*$/, "") + `\n${key}=${value}\n`;
}

async function inspectRelay(origin, secret, fetcher = fetch) {
  let response;
  try {
    response = await fetcher(origin + "/health", { signal: AbortSignal.timeout(800) });
  } catch (error) {
    if (error.cause?.code === "ECONNREFUSED") return null;
    throw new Error("The local relay port is unavailable or unhealthy; no existing process was stopped.");
  }
  const health = await response.json().catch(() => null);
  if (!response.ok || health?.provider !== "ssodaa" || health?.accessMode !== "read-only" || health?.configured !== true) {
    throw new Error("Existing relay is not a configured read-only local runtime; no process was stopped.");
  }
  const auth = await fetcher(origin + "/debug/templates", { headers: { "x-relay-secret": secret || "" }, signal: AbortSignal.timeout(1500) });
  if (!auth.ok) throw new Error("Existing local relay does not match this checkout's credential; no process was stopped.");
  const catalog = await fetcher(origin + "/admin/templates/categories", { headers: { "x-relay-secret": secret || "" }, signal: AbortSignal.timeout(10000) });
  const data = await catalog.json().catch(() => null);
  if (!catalog.ok || !Array.isArray(data?.categories) || !data.categories.length) {
    throw new Error("Local relay authentication passed but the provider category read failed; no process was stopped.");
  }
  return health;
}

function isProcessAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { return error.code !== "ESRCH"; }
}

async function withStartupLock(directory, operation, ownerAlive = isProcessAlive) {
  const lockPath = path.join(directory, "alimtalk-read-only-start.lock");
  let descriptor;
  try { descriptor = fs.openSync(lockPath, "wx"); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    let old;
    try { if (!fs.lstatSync(lockPath).isSymbolicLink()) old = JSON.parse(fs.readFileSync(lockPath, "utf8")); } catch { /* Unknown files are preserved. */ }
    if (old?.kind !== "petmanager-local-alimtalk-start" || !Number.isSafeInteger(old.pid) || old.pid <= 0 || ownerAlive(old.pid)) {
      throw new Error("Another local relay startup is in progress; no environment or process was changed.");
    }
    // Only a recognized runtime lock whose process no longer exists is stale.
    fs.unlinkSync(lockPath);
    descriptor = fs.openSync(lockPath, "wx");
  }
  try {
    fs.writeFileSync(descriptor, JSON.stringify({ kind: "petmanager-local-alimtalk-start", pid: process.pid, createdAt: new Date().toISOString() }));
    return await operation();
  } finally { fs.closeSync(descriptor); fs.unlinkSync(lockPath); }
}

async function ensureLocalAlimtalkRelay() {
  const runtimeRoot = path.join(appRoot, ".tmp/runtime-logs");
  assertOutsideOneDrive(runtimeRoot);
  fs.mkdirSync(runtimeRoot, { recursive: true });
  return withStartupLock(runtimeRoot, () => ensureConfiguredLocalAlimtalkRelay(runtimeRoot));
}

async function ensureConfiguredLocalAlimtalkRelay(runtimeRoot) {
  assertOutsideOneDrive(appRoot);
  assertOutsideOneDrive(relayRoot);
  if (!fs.existsSync(envPath) || fs.realpathSync(envPath) !== path.join(fs.realpathSync(appRoot), ".env.local")) {
    throw new Error("The canonical web .env.local is required; shared or linked environment files are not used.");
  }
  let text = fs.readFileSync(envPath, "utf8");
  let values = parseEnv(text);
  const local = validateLocalEnvironment(values);
  const existing = await inspectRelay(local.origin, values.ALIMTALK_RELAY_SECRET);
  if (existing) {
    if (!values.ALIMTALK_RELAY_SECRET?.startsWith("local-alimtalk-") || values.ALIMTALK_RELAY_ACCESS_MODE !== "read-only") {
      throw new Error("Existing relay credential has not been isolated for this checkout.");
    }
    return { reused: true, port: local.port, accessMode: "read-only", stop: () => {} };
  }

  // A missing listener is required for initial setup. Never replace a foreign
  // process, or rewrite an environment that failed the checks above.
  if (!values.ALIMTALK_RELAY_SECRET?.startsWith("local-alimtalk-")) {
    text = setEnvValue(text, "ALIMTALK_RELAY_SECRET", "local-alimtalk-" + crypto.randomBytes(32).toString("hex"));
  }
  text = setEnvValue(text, "ALIMTALK_RELAY_ACCESS_MODE", "read-only");
  fs.writeFileSync(envPath, text, "utf8");
  values = parseEnv(text);
  const synced = spawnSync(process.execPath, [path.join(__dirname, "sync-alimtalk-relay-env.cjs")], { cwd: appRoot, encoding: "utf8", windowsHide: true });
  if (synced.status !== 0) throw new Error("Local relay environment synchronization failed; no runtime was started.");

  const logPath = path.join(runtimeRoot, `alimtalk-read-only-${Date.now()}.log`);
  const fd = fs.openSync(logPath, "a");
  const loader = pathToFileURL(require.resolve("tsx", { paths: [relayRoot] })).href;
  const runtimeEnv = {
    ...process.env, NODE_ENV: "development", VERCEL: "0", VERCEL_ENV: "development",
    PORT: String(local.port), RELAY_ACCESS_MODE: "read-only", RELAY_SECRET: values.ALIMTALK_RELAY_SECRET,
    SSODAA_API_URL: values.ALIMTALK_API_URL || "https://apis.ssodaa.com/kakao/send/alimtalk",
    SSODAA_SENT_LIST_URL: values.ALIMTALK_SENT_LIST_URL || "https://apis.ssodaa.com/kakao/alimtalk/sent/list",
    SSODAA_API_KEY: values.ALIMTALK_API_KEY, SSODAA_TOKEN_KEY: values.ALIMTALK_TOKEN_KEY, SSODAA_SENDER_KEY: values.ALIMTALK_SENDER_KEY,
  };
  for (const [key, value] of Object.entries(values)) if (key.startsWith("ALIMTALK_TEMPLATE_")) runtimeEnv[key] = value;
  const child = spawn(process.execPath, ["--import", loader, path.join(relayRoot, "src/server.ts")], {
    cwd: relayRoot, env: runtimeEnv, detached: true, windowsHide: true, stdio: ["ignore", fd, fd],
  });
  fs.closeSync(fd);
  let failed = false;
  child.on("error", () => { failed = true; });
  child.on("exit", () => { failed = true; });
  const stop = () => { if (!failed) child.kill(); };
  try {
    for (let i = 0; i < 70; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (failed) throw new Error("The read-only relay exited during startup; inspect the local runtime log.");
      const health = await inspectRelay(local.origin, values.ALIMTALK_RELAY_SECRET);
      if (!health) continue;
      const record = { pid: child.pid, port: local.port, accessMode: "read-only", root: relayRoot, logPath, startedAt: new Date().toISOString() };
      fs.writeFileSync(path.join(runtimeRoot, "alimtalk-read-only-runtime.json"), JSON.stringify(record, null, 2));
      child.unref();
      return { ...record, reused: false, stop };
    }
    throw new Error("Read-only relay startup did not pass health and authentication checks.");
  } catch (error) { stop(); throw error; }
}

function readLocalWebEnvironment() {
  const values = parseEnv(fs.readFileSync(envPath, "utf8"));
  validateLocalEnvironment(values);
  return { ...process.env, ...values, NODE_ENV: "development", VERCEL: "0", VERCEL_ENV: "development", ALLOW_PROD_SUPABASE_IN_DEV: "false" };
}

module.exports = { ensureLocalAlimtalkRelay, inspectRelay, parseEnv, setEnvValue, validateLocalEnvironment, readLocalWebEnvironment, withStartupLock };
if (require.main === module) ensureLocalAlimtalkRelay().then(({ stop, ...result }) => console.log(JSON.stringify(result))).catch(error => {
  console.error(error.message); process.exitCode = 1;
});
