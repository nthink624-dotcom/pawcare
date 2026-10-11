import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../../${path}`, import.meta.url), "utf8");
const { isApprovedAndUsableTemplate, hasApprovedBookingConsentTemplateContract } =
  await import("../../src/server/alimtalk-approved-template.ts");

test("notification dispatch keeps duplicate, scheduling, and failure states explicit", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");

  assert.match(dispatch, /evaluateNotificationAbusePolicy/);
  assert.match(dispatch, /input\.skipIfExists && hasExistingNotification/);
  assert.match(dispatch, /const scheduledAt = input\.scheduledAt \?\? null/);
  assert.match(dispatch, /status = "failed"/);
  assert.match(dispatch, /fail_reason: failReason/);
  assert.match(dispatch, /scheduled_at: scheduledAt/);
  assert.match(dispatch, /provider_message_id: providerMessageId/);
});

test("consent template resolves from relay alias after review without a Vercel env edit", async () => {
  const resolver = await read("src/server/alimtalk-approved-template.ts");
  const dispatch = await read("src/server/notification-dispatch.ts");

  assert.match(resolver, /item\.alias === alias && \(!configuredCode \|\| item\.configuredCode === configuredCode\)/);
  assert.match(resolver, /configuredCode \|\| aliasEntry\?\.configuredCode/);
  assert.match(resolver, /isApprovedAndUsableTemplate\(detail\)/);
  assert.match(dispatch, /booking_consent_request" && connectedTemplate\?\.source !== "ssodaa_approved"/);
});

test("consent Alimtalk requires provider approval, active service, exact body, and the expected CTA", async () => {
  const resolver = await read("src/server/alimtalk-approved-template.ts");
  const contract = `[#{매장명}]\n\n#{보호자명}님, #{반려동물명} 미용 전 동의서를 확인해 주세요.\n\n방문 일정: #{예약일시}\n\n아래 버튼을 눌러 내용을 읽고 서명해 주세요.`;
  const detail = {
    templateCode: "consent-template",
    templateName: "동의서 작성 요청",
    templateContent: contract,
    inspectionStatus: "APR",
    serviceStatus: "ACT",
    buttons: [{ type: "WL", name: "동의서 작성", linkMobile: "https://www.petmanager.co.kr/book/manage?t=#{예약 확인 링크}" }],
  };

  assert.equal(isApprovedAndUsableTemplate(detail), true);
  assert.equal(isApprovedAndUsableTemplate({ ...detail, inspectionStatus: "" }), false);
  assert.equal(isApprovedAndUsableTemplate({ ...detail, serviceStatus: "" }), false);
  assert.equal(isApprovedAndUsableTemplate({ ...detail, serviceStatus: "S" }), false);
  assert.equal(hasApprovedBookingConsentTemplateContract(detail), true);
  assert.equal(hasApprovedBookingConsentTemplateContract({ ...detail, templateContent: `${contract} 변경` }), false);
  assert.equal(hasApprovedBookingConsentTemplateContract({ ...detail, buttons: [{ ...detail.buttons[0], name: "예약 확인" }] }), false);
  assert.match(resolver, /linkMobile !== bookingManageUrl \|\| linkPc !== bookingManageUrl/);
  const preparation = await read("src/server/booking-preparation.ts");
  assert.match(preparation, /if \(!active && !\["refund_record", "correct_noshow", "set_condition", "set_preferences"\]\.includes\(input\.action\)\)/);
});

test("Alimtalk failures refund consumed credits and preserve media delivery state", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");
  const migration = await read("../../supabase/migrations/202605220007_notification_delivery_audit.sql");

  assert.match(dispatch, /refundShopAlimtalkCredit/);
  assert.match(dispatch, /if \(creditReservation\?\.consumed\)/);
  assert.match(dispatch, /markNotificationMediaDeliveryResult/);
  assert.match(migration, /provider_delivery_status/);
  assert.match(migration, /credit_refund_event_id uuid/);
  assert.match(migration, /notification_delivery_checks/);
  assert.match(migration, /notifications_provider_message_idx/);
});

test("provider logs do not include recipient or relay secret payloads", async () => {
  const provider = await read("src/server/alimtalk-provider.ts");

  assert.match(provider, /relayUrlHost/);
  assert.match(provider, /relayUrlPathname/);
  const logLines = provider.split(/\r?\n/).filter((line) => /console\.(?:log|error)/.test(line));
  assert.equal(logLines.length, 3);
  assert.match(provider, /logOperationalEvent\("alimtalk\.relay_request_failed"/);
  for (const line of logLines) {
    assert.doesNotMatch(line, /input\.to|recipientName|alimtalkRelaySecret|alimtalkApiKey/);
  }
});

test("notification dispatch logs do not include phone tails", async () => {
  const dispatch = await read("src/server/notification-dispatch.ts");

  assert.doesNotMatch(dispatch, /function getPhoneTail|initialPhoneTail|phoneTail/);
});
