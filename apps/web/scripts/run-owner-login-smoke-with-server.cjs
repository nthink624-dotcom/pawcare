const { spawn, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
let baseUrl = (process.env.OWNER_LOGIN_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const explicitBaseUrl = Boolean(process.env.OWNER_LOGIN_SMOKE_BASE_URL);
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2_000);
  try {
    const response = await fetch(`${baseUrl}/login`, { method: "GET", signal: controller.signal });
    return response.ok || response.status < 500;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function getAvailablePort() {
  const net = require("node:net");
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : null;
      server.close(() => (port ? resolve(port) : reject(new Error("Could not resolve a local port"))));
    });
  });
}

function runNpmScript(script, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(`${npmCommand} run ${script}`, {
      cwd: process.cwd(),
      env,
      stdio: "inherit",
      shell: true,
    });

    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${script} failed with exit code ${code}`));
    });
    child.on("error", reject);
  });
}

function stopServerProcess(server) {
  if (!server || server.killed) return;
  if (process.platform === "win32" && server.pid) {
    spawnSync("taskkill", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  server.kill();
}

async function waitForServer() {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 120_000) {
    if (await isServerReady()) return;
    await delay(1_000);
  }
  throw new Error(`Local server did not become ready at ${baseUrl}`);
}

async function main() {
  let server = null;

  if (!(await isServerReady())) {
    if (explicitBaseUrl) {
      throw new Error(`Local server did not become ready at ${baseUrl}`);
    }
    const port = await getAvailablePort();
    baseUrl = `http://127.0.0.1:${port}`;
    const hasProductionBuild = fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));
    const localServerScript = hasProductionBuild ? "start:local" : "dev:local";
    server = spawn(`${npmCommand} run ${localServerScript}`, {
      cwd: process.cwd(),
      env: { ...process.env, PETMANAGER_LOCAL_PORT: String(port) },
      stdio: "inherit",
      shell: true,
    });
    server.on("error", (error) => {
      throw error;
    });
    await waitForServer();
  }

  try {
    await runNpmScript("smoke:owner-login", {
      ...process.env,
      OWNER_LOGIN_SMOKE_BASE_URL: baseUrl,
    });
  } finally {
    stopServerProcess(server);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
