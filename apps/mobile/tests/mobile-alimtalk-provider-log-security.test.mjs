import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(new URL("../src/server/alimtalk-provider.ts", import.meta.url));
const source = fs.readFileSync(sourcePath, "utf8");
const consoleCalls = source.match(/console\.(?:log|info|warn|error)\([\s\S]*?\n\s*\}\);/g) ?? [];

test("mobile Alimtalk logs use bounded diagnostics only", () => {
  assert.equal(consoleCalls.length, 3);
  assert.match(source, /logOperationalEvent\("alimtalk\.relay_request_failed"/);
  for (const consoleCall of consoleCalls) {
    assert.match(consoleCall, /eventCode:/);
    assert.match(consoleCall, /requestId/);
    assert.doesNotMatch(consoleCall, /input\.to|recipientName|phoneTail|bodyPreview|relayBody|responseBody|templateAlias|templateKey|message\s*:|stack|String\(error\)/);
  }
  assert.doesNotMatch(source, /function getPhoneTail|function getBodyPreview/);
});

test("mobile notification dispatch does not log phone tails", () => {
  const dispatchPath = fileURLToPath(new URL("../src/server/notification-dispatch.ts", import.meta.url));
  const dispatch = fs.readFileSync(dispatchPath, "utf8");

  assert.doesNotMatch(dispatch, /function getPhoneTail|initialPhoneTail|phoneTail/);
});
