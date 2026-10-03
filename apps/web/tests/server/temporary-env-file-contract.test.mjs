import assert from "node:assert/strict";
import { existsSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
const { createTemporaryEnvFile, removeTemporaryEnvFile } = require("../../scripts/lib/temporary-env-file.cjs");

test("Vercel env pull uses unique OS-temporary paths and removes only its own file", () => {
  const first = createTemporaryEnvFile("petmanager-env-contract");
  const second = createTemporaryEnvFile("petmanager-env-contract");

  try {
    assert.notEqual(first.directory, second.directory);
    assert.equal(path.dirname(first.file), first.directory);
    assert.equal(path.dirname(second.file), second.directory);
    assert.equal(path.dirname(first.directory), path.resolve(os.tmpdir()));

    writeFileSync(first.file, "SECRET=redacted-test-value\n", "utf8");
    writeFileSync(second.file, "SECRET=another-redacted-test-value\n", "utf8");
    removeTemporaryEnvFile(first);

    assert.equal(existsSync(first.directory), false);
    assert.equal(existsSync(second.file), true);
  } finally {
    removeTemporaryEnvFile(first);
    removeTemporaryEnvFile(second);
  }
});
