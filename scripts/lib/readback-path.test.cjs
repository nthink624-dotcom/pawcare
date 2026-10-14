const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveReadbackPath } = require("./readback-path.cjs");

test("readback selection keeps defaults and rejects missing or escaped targets", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "petmanager-readback-path-"));
  try {
    const root = path.join(temporary, "checkout");
    const selected = path.join(root, "evidence");
    fs.mkdirSync(selected, { recursive: true });
    fs.writeFileSync(path.join(selected, "snapshot.json"), "{}");
    assert.equal(resolveReadbackPath(root, "docs/snapshot.json", []), path.join(root, "docs/snapshot.json"));
    assert.equal(resolveReadbackPath(root, "docs/snapshot.json", ["--readback-root", "evidence"]), fs.realpathSync(path.join(selected, "snapshot.json")));
    assert.throws(() => resolveReadbackPath(root, "docs/snapshot.json", ["--readback-root"]), /argument is missing/);
    assert.throws(() => resolveReadbackPath(root, "docs/snapshot.json", ["--readback-root", temporary]), /inside this checkout/);
    assert.throws(() => resolveReadbackPath(root, "docs/missing.json", ["--readback-root", "evidence"]), /ENOENT/);
    fs.mkdirSync(path.join(selected, "directory.json"));
    assert.throws(() => resolveReadbackPath(root, "docs/directory.json", ["--readback-root", "evidence"]), /escaped/);
    fs.symlinkSync(temporary, path.join(root, "outside"), process.platform === "win32" ? "junction" : "dir");
    assert.throws(() => resolveReadbackPath(root, "docs/snapshot.json", ["--readback-root", "outside"]), /inside this checkout/);
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
});
