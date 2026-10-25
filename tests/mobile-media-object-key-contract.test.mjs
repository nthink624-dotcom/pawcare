import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/server/owner-media-service.ts", import.meta.url), "utf8");

test("mobile media object keys never include the client-provided filename", () => {
  assert.doesNotMatch(source, /fileBase/);
  assert.doesNotMatch(source, /originalFileName: input\.originalFileName/);
  assert.match(source, /\$\{params\.mediaAssetId\}\.\$\{ext\}/);
});
