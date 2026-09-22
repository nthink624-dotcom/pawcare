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

test("the owner shell no longer exposes an initial-setup page or resume entry", () => {
  assert.doesNotMatch(shell, /초기 설정 이어하기|초기 설정 가이드|<OwnerInitialSetupBlockingModal/);
  assert.doesNotMatch(preview, /<OwnerInitialSetupGuide/);
  assert.doesNotMatch(preview, /showInitialSetupAction=/);
});
