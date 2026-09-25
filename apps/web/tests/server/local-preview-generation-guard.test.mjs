import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  PREVIEW_DIST_ENV,
  snapshotBuildGeneration,
} = require("../../scripts/local-preview-generation.cjs");
const packageJson = require("../../package.json");

test("local preview snapshots one completed build generation before a later build replaces .next", () => {
  const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "petmanager-preview-generation-"));
  const buildDirectory = path.join(projectRoot, ".next");
  fs.mkdirSync(path.join(buildDirectory, "static", "chunks"), { recursive: true });
  fs.writeFileSync(path.join(buildDirectory, "BUILD_ID"), "first-generation");
  fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "owner-first.js"), "first");

  try {
    const snapshot = snapshotBuildGeneration({ projectRoot, buildDirectory });
    fs.rmSync(buildDirectory, { recursive: true, force: true });
    fs.mkdirSync(path.join(buildDirectory, "static", "chunks"), { recursive: true });
    fs.writeFileSync(path.join(buildDirectory, "BUILD_ID"), "second-generation");
    fs.writeFileSync(path.join(buildDirectory, "static", "chunks", "owner-second.js"), "second");

    assert.equal(fs.readFileSync(path.join(snapshot.destinationDirectory, "BUILD_ID"), "utf8"), "first-generation");
    assert.equal(fs.readFileSync(path.join(snapshot.destinationDirectory, "static", "chunks", "owner-first.js"), "utf8"), "first");
    assert.equal(fs.existsSync(path.join(snapshot.destinationDirectory, "static", "chunks", "owner-second.js")), false);
  } finally {
    fs.rmSync(projectRoot, { recursive: true, force: true });
  }
});

test("canonical local preview uses the immutable snapshot while ordinary builds stay serialized", () => {
  assert.equal(packageJson.scripts.build, "node scripts/run-next-build-with-preview-lock.cjs");
  assert.equal(packageJson.scripts["start:local"], "node scripts/start-local-preview.cjs");
  const nextConfig = fs.readFileSync(path.resolve("next.config.ts"), "utf8");
  assert.match(nextConfig, new RegExp(PREVIEW_DIST_ENV));
  assert.match(nextConfig, /distDir: localPreviewDistDir \|\| "\.next"/);
});
