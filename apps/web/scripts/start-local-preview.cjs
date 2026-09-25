const { spawn } = require("child_process");
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
const child = spawn(process.execPath, [nextBin, "start", "--hostname", "127.0.0.1", "--port", "3000"], {
  cwd: projectRoot,
  env: { ...process.env, [PREVIEW_DIST_ENV]: generation.distDir },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}

child.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
