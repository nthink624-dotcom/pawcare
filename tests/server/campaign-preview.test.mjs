import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { CAMPAIGN_PREVIEW_POLICY, DEFAULT_CAMPAIGN_CONSENT, PLATFORM_DELIVERY_ELIGIBILITY, createCampaignPreviewEvent, isCampaignSourceChannel } from "../../src/lib/campaign-preview-contract.ts";
import { createApplicationReferenceCode, createSuppressionKey } from "../../src/server/campaign-preview-security.ts";

test("preview remains fail-closed for every write or external delivery path", () => {
  assert.equal(CAMPAIGN_PREVIEW_POLICY.previewOnly, true);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.formPublishable, false);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.formSubmissionEnabled, false);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.marketingDmEnabled, false);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.analyticsEnabled, false);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.externalCallsEnabled, false);
  assert.equal(CAMPAIGN_PREVIEW_POLICY.productionPublishable, false);
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
  assert.match(ui, /월 29,000원/);
  assert.match(ui, /알림톡 포함 · 별도 충전 없음/);
  assert.match(ui, /카드 등록 없이 14일 무료 체험하세요. 체험 종료 후에는 월 29,000원의 단일 요금제로 계속 이용할 수 있습니다./);
  assert.match(ui, /매장 사례 활용에 별도 동의한 경우 무료 이용 30일이 추가되며, 이후 동일한 월 29,000원 단일 요금제가 적용됩니다./);
  assert.doesNotMatch(ui, /부가세 (?:포함|별도)/);
  assert.match(ui, /Instagram 계정정보 광고 목적 이용/);
  assert.match(ui, /Instagram DM 광고성 정보 1회 수신/);
  assert.match(ui, /사례 활용 \+ 30일 추가/);
  for (const label of ["매장명", "신청자 역할", "운영 형태", "예약 접수 방식", "불편한 장면"]) assert.match(ui, new RegExp(`label="${label}"`));
  assert.doesNotMatch(ui, /label="(?:담당자|연락처|Instagram 계정)"|테스트 (?:담당자|연락처|계정)/);
  assert.match(ui, /예약 예시 A/);
  assert.doesNotMatch(ui, /10:00 두부|13:30 보리|16:00 구름/);
  assert.match(ui, /기존 예약이 자동 연동되거나 모든 예약이 자동 처리되는 서비스는 아닙니다/);
  assert.match(ui, /제공사 장애·정책 제한·비정상적이거나 오남용으로 판단되는 발송은 지연 또는 제한/);
  assert.match(ui, /실제 신청·저장·연락·자동 연동 없음/);
  assert.doesNotMatch(ui, /useState|localStorage|document\.cookie|searchParams/);
});
