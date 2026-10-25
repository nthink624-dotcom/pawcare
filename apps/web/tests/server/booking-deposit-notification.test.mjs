import assert from "node:assert/strict";
import test from "node:test";
import { APPROVED_ALIMTALK_CONTRACTS } from "@petmanager/shared/contracts/alimtalk";
import { DEPOSIT_ALIMTALK_REVIEW_CONTRACTS } from "@petmanager/shared/contracts/deposit-alimtalk-review";
import { hasApprovedBookingDepositTemplateContract, hasDepositOperationalTemplateContract, isApprovedAndUsableTemplate, getApprovedSsodaaTemplateFromCatalog } from "../../src/server/alimtalk-approved-template.ts";
import { shouldSendByGuardianSettings, shouldSendByShopSettings } from "../../src/lib/notification-registry.ts";
import { defaultGuardianNotificationSettings, defaultShopNotificationSettings } from "../../src/lib/notification-settings.ts";

const detail = {
  templateCode: "booking_deposit_request_v2", templateName: "예약금 요청",
  templateContent: DEPOSIT_ALIMTALK_REVIEW_CONTRACTS.booking_deposit_request.body,
  inspectionStatus: "APR", serviceStatus: "ACT",
  buttons: [{ type: "WL", name: "예약금 입금 신고", linkMobile: "https://www.petmanager.co.kr/book/manage?t=#{예약관리토큰}" }],
};
test("deposit request needs provider approval and service availability", () => {
  assert.equal(isApprovedAndUsableTemplate(detail, "booking_deposit_request"), true);
  for (const value of ["", "REQ", "REJ"]) assert.equal(isApprovedAndUsableTemplate({...detail,inspectionStatus:value}, "booking_deposit_request"), false);
  assert.equal(isApprovedAndUsableTemplate({...detail,serviceStatus:"STOP"}, "booking_deposit_request"), false);
  assert.equal(isApprovedAndUsableTemplate({...detail,serviceStatus:"A"}), true);
  assert.equal(isApprovedAndUsableTemplate({...detail,serviceStatus:"S"}), false);
});
test("deposit request cannot reuse a consent body or an unexpected button", () => {
  assert.equal(hasApprovedBookingDepositTemplateContract(detail), true);
  assert.equal(hasApprovedBookingDepositTemplateContract({...detail,templateContent:APPROVED_ALIMTALK_CONTRACTS.booking_consent_request.body}), false);
  assert.equal(hasApprovedBookingDepositTemplateContract({...detail,buttons:[{...detail.buttons[0],name:"동의서 작성"}]}), false);
  assert.equal(hasApprovedBookingDepositTemplateContract({...detail,buttons:[]}), false);
  assert.equal(hasApprovedBookingDepositTemplateContract({...detail,templateCode:"booking_deposit_request",templateContent:APPROVED_ALIMTALK_CONTRACTS.booking_deposit_request.body}),false);
});

test("each additional deposit notice uses its own versioned contract and respects opt-outs",()=>{
  for(const alias of ["booking_deposit_cancelled","booking_deposit_expired","booking_deposit_refunded"]){
    const contract=DEPOSIT_ALIMTALK_REVIEW_CONTRACTS[alias];
    assert.equal(hasDepositOperationalTemplateContract(alias,{...detail,templateCode:contract.code,templateContent:contract.body,buttons:[{...detail.buttons[0],name:contract.button}]}),true);
    assert.equal(hasDepositOperationalTemplateContract(alias,detail),false);
    assert.equal(shouldSendByShopSettings({...defaultShopNotificationSettings,enabled:false},alias),false);
    assert.equal(shouldSendByGuardianSettings({...defaultGuardianNotificationSettings,enabled:false},alias),false);
    assert.equal(shouldSendByGuardianSettings({...defaultGuardianNotificationSettings,deposit_request_enabled:false},alias),false);
  }
});
test("deposit request observes guardian and shop opt-out independently of consent", () => {
  assert.equal(shouldSendByGuardianSettings({...defaultGuardianNotificationSettings,consent_request_enabled:false},"booking_deposit_request"), true);
  assert.equal(shouldSendByGuardianSettings({...defaultGuardianNotificationSettings,deposit_request_enabled:false},"booking_deposit_request"), false);
  assert.equal(shouldSendByGuardianSettings({...defaultGuardianNotificationSettings,enabled:false},"booking_deposit_request"), false);
  assert.equal(shouldSendByShopSettings(defaultShopNotificationSettings,"booking_deposit_request"), true);
  assert.equal(shouldSendByShopSettings({...defaultShopNotificationSettings,enabled:false},"booking_deposit_request"), false);
  assert.equal(shouldSendByShopSettings({...defaultShopNotificationSettings,enabled:false},"booking_confirmed"), false);
});
test("deposit alias resolves only an approved template from the provider catalog", async () => {
  const catalog={items:[{alias:"booking_deposit_request",configuredCode:detail.templateCode,detail}],allTemplates:[detail]};
  assert.equal((await getApprovedSsodaaTemplateFromCatalog("booking_deposit_request",catalog,detail.templateCode))?.templateCode,detail.templateCode);
  assert.equal(await getApprovedSsodaaTemplateFromCatalog("booking_deposit_request",{allTemplates:[{...detail,inspectionStatus:"REQ"}]},detail.templateCode),null);
});
