import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CAMPAIGN_PREVIEW_POLICY, DEFAULT_CAMPAIGN_CONSENT, PLATFORM_DELIVERY_ELIGIBILITY, createCampaignPreviewEvent, isCampaignSourceChannel } from "../../src/lib/campaign-preview-contract.ts";
import { createApplicationReferenceCode, createSuppressionKey } from "../../src/server/campaign-preview-security.ts";

test("preview remains fail-closed for every write or external delivery path", () => {
  assert.equal(CAMPAIGN_PREVIEW_POLICY.formPublishable, false);
  for (const [key, value] of Object.entries(CAMPAIGN_PREVIEW_POLICY)) if (key.endsWith("Enabled") || key === "externalExecution") assert.equal(value, false, key);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.lawfulUseBasisStatus, "policy_review_pending");
});

test("Instagram consents are independent and never create platform eligibility", () => {
  assert.equal(DEFAULT_CAMPAIGN_CONSENT.accountAdvertisingUseOptIn, false);
  assert.equal(DEFAULT_CAMPAIGN_CONSENT.instagramAdDmReceiveOptIn, false);
  assert.equal(PLATFORM_DELIVERY_ELIGIBILITY, "not_evaluated");
});

test("analytics contract is allowlisted, session-only, unlinked, and externally disabled", () => {
  assert.equal(isCampaignSourceChannel("Instagram"), true);
  assert.equal(isCampaignSourceChannel("instagram_handle"), false);
  const event = createCampaignPreviewEvent("cta_click", "Instagram");
  assert.deepEqual(event, { eventName: "cta_click", sourceChannel: "Instagram", creativeVariant: "approved_single_title_r1", funnelUnit: "session", shopLinkage: "none", externalAnalyticsSent: false });
  assert.equal(JSON.stringify(event).includes("email"), false);
});

test("reference codes are opaque, short-lived, single-purpose, and non-reused", () => {
  const now = new Date("2026-08-26T00:00:00.000Z");
  const first = createApplicationReferenceCode(now);
  const second = createApplicationReferenceCode(now);
  assert.notEqual(first.code, second.code);
  assert.equal(first.purpose, "campaign_preview_fixture");
  assert.equal(first.used, false);
  assert.equal(new Date(first.expiresAt).getTime() - now.getTime(), 15 * 60 * 1000);
});

test("suppression keys use keyed HMAC and require a strong secret", () => {
  const secret = "preview-secret-that-is-at-least-32-characters";
  assert.equal(createSuppressionKey("same-value", secret), createSuppressionKey("same-value", secret));
  assert.notEqual(createSuppressionKey("same-value", secret), createSuppressionKey("same-value", `${secret}-other`));
  assert.throws(() => createSuppressionKey("same-value", "short"));
});

test("route and UI expose preview only with an explicit flag and no submit action", async () => {
  const page = await readFile(new URL("../../src/app/campaign/solo-grooming-trial/page.tsx", import.meta.url), "utf8");
  const ui = await readFile(new URL("../../src/components/campaign/solo-grooming-trial-preview.tsx", import.meta.url), "utf8");
  assert.match(page, /CAMPAIGN_SOLO_GROOMING_PREVIEW_ENABLED/);
  assert.match(page, /notFound/);
  assert.match(ui, /disabled/);
  assert.doesNotMatch(ui, /fetch\(|formAction|action=|sendBeacon|pixel|webhook/i);
  assert.match(ui, /30일 무료 이용을 추가 제공받음/);
});
