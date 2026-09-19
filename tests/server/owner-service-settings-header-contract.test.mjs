import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("service-price settings uses one safe app-settings back header across price-guide states", async () => {
  const [serviceScreen, ownerPreview] = await Promise.all([
    readFile(new URL("../../src/components/owner-web/service-management-screen.tsx", import.meta.url), "utf8"),
    readFile(new URL("../../src/components/owner-web/owner-web-preview.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(serviceScreen, /data-testid="service-settings-header"/);
  assert.match(serviceScreen, /onBackToSettings/);
  assert.match(serviceScreen, /aria-label="설정으로 돌아가기"/);
  assert.match(serviceScreen, /<ChevronLeft className="h-5 w-5"/);
  assert.match(serviceScreen, /h-11 w-11/);
  assert.match(serviceScreen, /text-\[20px\] font-semibold leading-7/);
  assert.match(serviceScreen, /서비스·요금 설정/);
  assert.match(serviceScreen, /if \(priceGuideOnboarding\) \{[\s\S]*\{serviceSettingsHeader\}/);
  assert.match(serviceScreen, /const content = \([\s\S]*\{serviceSettingsHeader\}/);
  assert.match(ownerPreview, /onBackToSettings=\{onServiceSettingsBack\}/);
  assert.match(ownerPreview, /\(\) => setActiveScreen\("shopInfo"\)/);
  assert.doesNotMatch(ownerPreview, /history\.(?:back|go)\(/);
});
