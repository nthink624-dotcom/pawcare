import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const require = createRequire(import.meta.url);
const { validateProductionBuildSource } = require("../../../../scripts/check-production-build-source.cjs");
const cleanSource = {
  vercel: "1",
  vercelEnv: "production",
  vercelGitCommitSha: "19916fbc126b0b4af74e44084e526f06979acbc9",
  repositoryRoot: path.resolve(fileURLToPath(new URL("../../../../", import.meta.url))),
  gitHead: "19916fbc126b0b4af74e44084e526f06979acbc9",
  gitStatus: "",
};

test("production build source gate leaves local and preview builds alone", () => {
  assert.deepEqual(validateProductionBuildSource({ ...cleanSource, vercelEnv: "preview" }), []);
  assert.deepEqual(validateProductionBuildSource({ ...cleanSource, vercel: "0" }), []);
});

test("production build source gate requires the declared Git commit and a clean checkout", () => {
  assert.deepEqual(validateProductionBuildSource(cleanSource), []);
  assert.ok(validateProductionBuildSource({ ...cleanSource, vercelGitCommitSha: "" })
    .some((failure) => failure.includes("VERCEL_GIT_COMMIT_SHA")));
  assert.ok(validateProductionBuildSource({ ...cleanSource, gitHead: "0000000000000000000000000000000000000000" })
    .some((failure) => failure.includes("does not match")));
  assert.ok(validateProductionBuildSource({ ...cleanSource, gitStatus: "?? dev-only-file.ts\n" })
    .some((failure) => failure.includes("uncommitted or untracked")));
  assert.ok(validateProductionBuildSource({ ...cleanSource, repositoryRoot: "" })
    .some((failure) => failure.includes("verifiable PetManager Git checkout")));
});
