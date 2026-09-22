import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path) {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const preview = source("src/components/owner-web/owner-web-preview.tsx");
const shell = source("src/components/owner-web/owner-web-app-shell.tsx");

test("incomplete owner shops open the normal dashboard instead of the removed setup page", () => {
  assert.doesNotMatch(preview, /if \(!getBootstrapOwnerInitialSetupReadiness\(data\)\.completed\) return "operatingHours"/);
  assert.match(preview, /function getInitialOwnerWebScreen\(data: BootstrapPayload\): OwnerWebScreenKey \{[\s\S]*if \(!getBootstrapOwnerInitialSetupReadiness\(data\)\.completed\) return "schedule";/);
  assert.match(preview, /function getRequestedOwnerWebScreen\(data: BootstrapPayload\): OwnerWebScreenKey \{[\s\S]*if \(!getBootstrapOwnerInitialSetupReadiness\(data\)\.completed\) return "schedule";/);
});

test("the owner shell keeps the normal dashboard and opens the existing setup modal on demand", () => {
  assert.match(shell, /설정 마무리하기/);
  assert.match(preview, /<OwnerInitialSetupGuide/);
  assert.match(preview, /open=\{initialSetupOpen\}/);
  assert.match(preview, /setInitialSetupOpen\(true\)/);
  assert.match(preview, /const visibility = resolveOwnerInitialSetupVisibility[\s\S]*setInitialSetupOpen\(visibility\.open\)/);
  assert.doesNotMatch(preview, /setActiveScreen\(screenForInitialSetupStep\(readiness\.nextStep/);
});
