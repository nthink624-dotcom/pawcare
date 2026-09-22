import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../../src/server/media-service.ts", import.meta.url), "utf8");

test("expired media cleanup verifies every provider object before marking metadata deleted", () => {
  const deleteIndex = source.indexOf("await removeMediaStorageObjects({ bucket, paths });");
  const verifyIndex = source.indexOf("verifyMediaStorageObjectsAbsent({ bucket, paths })", deleteIndex);
  const statusIndex = source.indexOf('status: "deleted"', verifyIndex);

  assert.ok(deleteIndex >= 0);
  assert.ok(verifyIndex > deleteIndex);
  assert.ok(statusIndex > verifyIndex);
});
