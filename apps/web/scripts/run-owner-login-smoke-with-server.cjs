const { spawn } = require("child_process");

const DEFAULT_BASE_URL = "http://127.0.0.1:3000";
const baseUrl = (process.env.OWNER_LOGIN_SMOKE_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, "");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isServerReady() {
  try {
    const response = await fetch(`${baseUrl}/login`, { method: "GET" });
    return response.ok || response.status < 500;
  } catch {
    return false;
  }
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
    server = spawn(`${npmCommand} run dev:local`, {
      cwd: process.cwd(),
      env: process.env,
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
    if (server && !server.killed) {
      server.kill();
    }
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
