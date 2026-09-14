import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [nextConfig, ownerMobilePage] = await Promise.all([
  readFile(new URL("../next.config.ts", import.meta.url), "utf8"),
  readFile(new URL("../src/app/owner/mobile/page.tsx", import.meta.url), "utf8"),
]);

const forbiddenLoopback = /localhost|127\.0\.0\.1|:3100/i;

test("production owner mobile page renders the authenticated OwnerApp flow directly", () => {
  assert.match(ownerMobilePage, /import OwnerShell from "@\/components\/owner\/owner-shell"/);
  assert.match(ownerMobilePage, /fetchApiJsonWithAuth<OwnedShopSummary\[]>\("\/api\/owner\/shops"\)/);
  assert.match(ownerMobilePage, /fetchApiJsonWithAuth<BootstrapPayload>/);
  assert.match(ownerMobilePage, /<OwnerShell/);
  assert.doesNotMatch(ownerMobilePage, forbiddenLoopback);
  assert.doesNotMatch(ownerMobilePage, /OwnerMobileRedirectPage|MOBILE_OWNER_URL|window\.location\.replace/);
});

test("production redirect destinations never target a loopback or port 3100", () => {
  const redirectDestinations = [
    ...nextConfig.matchAll(/destination\s*:\s*(["'`])([^"'`]+)\1/g),
  ].map((match) => match[2]);

  for (const destination of redirectDestinations) {
    assert.doesNotMatch(destination, forbiddenLoopback);
  }

  assert.doesNotMatch(
    nextConfig,
    /source\s*:\s*(["'`])\/owner\/mobile\1[\s\S]{0,400}destination\s*:/,
  );
});
