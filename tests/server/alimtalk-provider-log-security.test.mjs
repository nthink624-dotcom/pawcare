import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { fileURLToPath } from "node:url";

const sourcePath = fileURLToPath(
  new URL("../../src/server/alimtalk-provider.ts", import.meta.url),
);
const source = fs.readFileSync(sourcePath, "utf8");
const consoleCalls = source.match(/console\.(?:log|info|warn|error)\([\s\S]*?\n\s*\}\);/g) ?? [];

test("Alimtalk provider logs expose only fixed, non-sensitive diagnostics", () => {
  assert.equal(consoleCalls.length, 4, "Every provider console call must stay covered by this test.");

  for (const consoleCall of consoleCalls) {
    assert.match(consoleCall, /eventCode:/);
    assert.match(consoleCall, /relayUrlHost/);
    assert.match(consoleCall, /relayUrlPathname/);
    assert.doesNotMatch(
      consoleCall,
      /templateAlias|templateKey|phoneTail|bodyPreview|relayBody|responseBody|\bstack\b|\bmessage\s*:|error\.(?:message|stack)|String\(error\)/,
    );
  }

  const responseLog = consoleCalls.find((consoleCall) =>
    consoleCall.includes("ALIMTALK_RELAY_RESPONSE_RECEIVED"),
  );
  assert.ok(responseLog);
  assert.match(responseLog, /status: relayResponse\.status/);
  assert.match(responseLog, /ok: relayResponse\.ok/);

  assert.doesNotMatch(source, /function getPhoneTail\(/);
  assert.doesNotMatch(source, /function getBodyPreview\(/);
});

test("Relay payload, authentication header, and response interpretation stay intact", () => {
  assert.match(source, /"x-relay-secret": serverEnv\.alimtalkRelaySecret/);
  assert.match(source, /to: input\.to/);
  assert.match(source, /message: input\.message/);
  assert.match(source, /templateAlias: relayTemplateKey \? null : input\.templateAlias \?\? null/);
  assert.match(source, /templateKey: relayTemplateKey/);
  assert.match(source, /relayContentType\.includes\("application\/json"\)/);
  assert.match(source, /providerMessageId:/);
  assert.match(source, /responseBody: relayBody/);
});
