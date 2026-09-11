const fs = require("fs");
const path = require("path");

const LOCK_FILE_NAME = "next-build-generation.lock";
const PREVIEW_DIST_ENV = "PETMANAGER_LOCAL_PREVIEW_DIST_DIR";

function sleep(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function acquireBuildGenerationLock({ projectRoot, timeoutMs = 180000, pollMs = 200 }) {
  const lockDirectory = path.join(projectRoot, ".tmp", "runtime-locks");
  const lockPath = path.join(lockDirectory, LOCK_FILE_NAME);
  fs.mkdirSync(lockDirectory, { recursive: true });

  const deadline = Date.now() + timeoutMs;
  while (true) {
    try {
      const handle = fs.openSync(lockPath, "wx");
      fs.writeFileSync(handle, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
      return {
        release() {
          fs.closeSync(handle);
          fs.rmSync(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (error && error.code !== "EEXIST") throw error;
      if (Date.now() >= deadline) {
        throw new Error("A local preview build or snapshot is already in progress; start/build was blocked before assets could mix.");
      }
      sleep(pollMs);
    }
  }
}

function readBuildId(buildDirectory) {
  const buildIdPath = path.join(buildDirectory, "BUILD_ID");
  if (!fs.existsSync(buildIdPath)) {
    throw new Error("No completed .next build is available; local preview was not started.");
  }
  const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
  if (!buildId) throw new Error("The completed .next build has no BUILD_ID; local preview was not started.");
  return buildId;
}

function copyRuntimeBuild({ sourceDirectory, destinationDirectory }) {
  fs.cpSync(sourceDirectory, destinationDirectory, {
    recursive: true,
    errorOnExist: true,
    filter(source) {
      return path.basename(source) !== "cache";
    },
  });
}

function snapshotBuildGeneration({ projectRoot, buildDirectory = path.join(projectRoot, ".next") }) {
  const buildId = readBuildId(buildDirectory);
  const generationRoot = path.join(projectRoot, ".tmp", "runtime-preview-generations");
  const destinationDirectory = path.join(generationRoot, buildId);

  fs.mkdirSync(generationRoot, { recursive: true });
  if (!fs.existsSync(destinationDirectory)) {
    const stagingDirectory = path.join(
      generationRoot,
      `.${buildId}.staging-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    );
    copyRuntimeBuild({ sourceDirectory: buildDirectory, destinationDirectory: stagingDirectory });
    const copiedBuildId = readBuildId(stagingDirectory);
    const sourceBuildIdAfterCopy = readBuildId(buildDirectory);
    if (copiedBuildId !== buildId || sourceBuildIdAfterCopy !== buildId) {
      fs.rmSync(stagingDirectory, { recursive: true, force: true });
      throw new Error("The .next generation changed while the preview snapshot was being made; local preview was not started.");
    }
    fs.renameSync(stagingDirectory, destinationDirectory);
  }

  if (readBuildId(destinationDirectory) !== buildId) {
    throw new Error("The immutable local preview generation is invalid; local preview was not started.");
  }

  return {
    buildId,
    destinationDirectory,
    distDir: path.relative(projectRoot, destinationDirectory).replaceAll("\\", "/"),
  };
}

module.exports = {
  PREVIEW_DIST_ENV,
  acquireBuildGenerationLock,
  copyRuntimeBuild,
  readBuildId,
  snapshotBuildGeneration,
};
