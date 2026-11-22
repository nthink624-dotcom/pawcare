const { spawn } = require("node:child_process");
const nextBin = require.resolve("next/dist/bin/next");
const { ensureLocalAlimtalkRelay, readLocalWebEnvironment } = require("./start-local-alimtalk-relay.cjs");
const { withDevelopmentMemoryGuard } = require("./react-flight-dev-memory-guard.cjs");

const port = String(process.env.PLAYWRIGHT_PORT || process.env.PETMANAGER_LOCAL_PORT || "3000");
(async () => {
  const relay = await ensureLocalAlimtalkRelay();
  try {
    console.log(`[local] AlimTalk relay ready on ${relay.port} (${relay.accessMode}).`);
    const environment = readLocalWebEnvironment();
    environment.NODE_OPTIONS = withDevelopmentMemoryGuard(environment.NODE_OPTIONS || "");
    const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", port, ...process.argv.slice(2)], {
      cwd: process.cwd(),
      env: environment,
      stdio: "inherit",
    });
    for (const signal of ["SIGINT", "SIGTERM"]) {
      process.once(signal, () => { child.kill(signal); relay.stop(); });
    }
    child.once("exit", (code, signal) => {
      relay.stop();
      process.exitCode = code ?? (signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1);
    });
    child.once("error", () => { relay.stop(); process.exitCode = 1; });
  } catch (error) {
    relay.stop();
    throw error;
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
