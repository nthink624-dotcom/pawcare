const { spawnSync } = require("child_process");
const path = require("path");
const { PREVIEW_DIST_ENV, acquireBuildGenerationLock } = require("./local-preview-generation.cjs");

const projectRoot = path.resolve(__dirname, "..");
const lock = acquireBuildGenerationLock({ projectRoot });

try {
  const nextBin = require.resolve("next/dist/bin/next");
  const buildEnv = { ...process.env };
  delete buildEnv[PREVIEW_DIST_ENV];
  const result = spawnSync(process.execPath, [nextBin, "build"], {
    cwd: projectRoot,
    env: buildEnv,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  lock.release();
}
