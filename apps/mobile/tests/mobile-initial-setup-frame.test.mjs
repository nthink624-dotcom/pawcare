import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../src/${file}`, import.meta.url), "utf8");
const [flow, frame, modal, price, preview, page] = await Promise.all([
  read("components/owner/owner-initial-setup-flow.tsx"),
  read("components/owner/owner-initial-setup-frame.tsx"),
  read("components/ui/setup-modal.tsx"),
  read("components/auth/mobile-ai-price-guide-fixture.tsx"),
  read("components/auth/mobile-price-photo-registration-preview.tsx"),
  read("app/dev/price-photo-registration/page.tsx"),
]);

test("all owner setup stages share the PC-style mobile frame and existing inputs", () => {
  assert.equal([...flow.matchAll(/<OwnerInitialSetupFrame step=\{step\}/g)].length, 1);
  assert.match(flow, /<SetupHoursFields/);
  assert.match(flow, /<SetupStaffFields/);
  assert.match(flow, /presentation="embedded" setupFlow shopId=\{bootstrap.shop.id\}/);
  assert.match(frame, /data-setup-progress/);
  assert.doesNotMatch(frame, /data-setup-step-nav/);
  assert.doesNotMatch(frame, /data-owner-setup-count|<header|초기 설정 나중에 하기/);
  assert.match(frame, /ref=\{headingRef\} tabIndex=\{-1\} data-setup-heading/);
  assert.match(frame, /<SetupModal contained/);
  assert.match(modal, /fullScreen = false/);
});

test("price completion stays guarded by live save/readback while its actions use the shared frame", () => {
  assert.match(flow, /operations = liveSetupOperations/);
  assert.match(flow, /saveStep: saveSetupStep, reload: reloadSetup/);
  assert.match(flow, /const fresh = await reloadSetup\(bootstrap.shop.id\)/);
  assert.match(flow, /if \(!fresh.initialSetupReadiness.completed\) throw/);
  assert.match(flow, /writeOwnerPriceGuideSessionDraft\(priceGuideKey, state \?\? null\); advance\("staff"\)/);
  assert.match(price, /createPortal\(reviewFooter, setupFooterTarget\)/);
  assert.match(price, /if \(!document \|\| saving \|\| isDirty \|\| !canAutoSavePriceGuideDocument\(document\)\) return/);
  assert.match(price, /비식별 파생 이미지를 OpenAI로 전송/);
});

test("the existing development preview renders the actual full wizard using in-memory operations", () => {
  assert.match(preview, /<InitialSetupWizard bootstrap=\{preview.bootstrap\}/);
  assert.match(preview, /createInMemoryAuthenticatedOwnerTransport\(\)/);
  assert.match(preview, /fetchImpl: transport.fetchImpl/);
  assert.doesNotMatch(preview, /<form|<SetupHoursFields|<SetupStaffFields/);
  assert.match(page, /process.env.NODE_ENV === "production" \|\| process.env.VERCEL_ENV === "production"/);
});
