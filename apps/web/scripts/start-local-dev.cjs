const { spawn } = require("node:child_process");
const nextBin = require.resolve("next/dist/bin/next");

const port = String(process.env.PLAYWRIGHT_PORT || process.env.PETMANAGER_LOCAL_PORT || "3000");
const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", "--port", port], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
