import assert from 'node:assert/strict';
import test from 'node:test';
import { guidanceDeliveryOutcome } from '../../src/server/booking-preparation.ts';
import { hasApprovedBookingConsentTemplateContract, isApprovedAndUsableTemplate } from '../../src/server/alimtalk-approved-template.ts';
import { APPROVED_ALIMTALK_CONTRACTS } from '@petmanager/shared/contracts/alimtalk';

test('consent delivery failure/timeout/simulation never becomes success',()=>{
  for(const status of ['failed','timeout','unknown'])assert.equal(guidanceDeliveryOutcome(status,'실패','consent').status,'failed');
  assert.equal(guidanceDeliveryOutcome('mocked',null,'consent').status,'blocked');
  assert.equal(guidanceDeliveryOutcome('skipped',null,'consent').status,'blocked');
  assert.equal(guidanceDeliveryOutcome('queued',null,'consent').status,'queued');
  assert.equal(guidanceDeliveryOutcome('sent',null,'consent').status,'sent');
});
test('existing consent template contract rejects pending/rejected and wrong content/buttons',()=>{
  const contract=APPROVED_ALIMTALK_CONTRACTS.booking_consent_request;
  const approved={templateCode:'current-consent-code',templateName:'current-consent-name',templateContent:contract.body,inspectionStatus:'APR',serviceStatus:'ACT',buttons:[{type:'WL',name:contract.button,linkMobile:'https://www.petmanager.co.kr/m?t=#{예약관리토큰}'}]};
  assert.equal(isApprovedAndUsableTemplate(approved,'booking_consent_request'),true);
  assert.equal(hasApprovedBookingConsentTemplateContract(approved),true);
  for(const inspectionStatus of ['REQ','REJ',''])assert.equal(isApprovedAndUsableTemplate({...approved,inspectionStatus},'booking_consent_request'),false);
  assert.equal(hasApprovedBookingConsentTemplateContract({...approved,templateContent:'다른 내용'}),false);
  assert.equal(hasApprovedBookingConsentTemplateContract({...approved,buttons:[]}),false);
  assert.equal(hasApprovedBookingConsentTemplateContract({...approved,buttons:[{...approved.buttons[0],name:'다른 버튼'}]}),false);
});
