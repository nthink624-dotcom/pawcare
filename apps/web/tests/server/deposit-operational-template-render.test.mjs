import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
registerHooks({resolve(s,c,next){
 if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__depositMappingAdmin;');
 if(s==='@/lib/server-env')return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"test-only"};export const getConfiguredAlimtalkTemplateKey=()=>null;');
 return next(s,c);
}});
const {DEPOSIT_ALIMTALK_REVIEW_CONTRACTS:contracts}=await import('@petmanager/shared/contracts/deposit-alimtalk-review');
const {APPROVED_ALIMTALK_CONTRACTS:legacy}=await import('@petmanager/shared/contracts/alimtalk');
const {getApprovedSsodaaNotificationTemplate}=await import('../../src/server/alimtalk-approved-template.ts');
const {isSameBookingManageLink}=await import('@petmanager/shared/lib/booking-manage-link');
const variables={'매장명':'가상 매장','보호자명':'김민지','반려동물명':'보리','예약일시':'10월22일09:00','은행명':'가상 은행','입금계좌':'000000','예금주':'송금 금지','예약금액':'20,000','납부기한':'10월21일09:00','기한안내':'신고 후 매장 확인을 기다려 주세요.','예약관리토큰':'fixture-token','예약 확인 링크':'https://www.petmanager.co.kr/book/manage?t=fixture-token'};
variables['예약 확인 링크']='https://www.petmanager.co.kr/m?t=fixture-token';
function catalog(alias,patch={}){const c=contracts[alias],detail={templateCode:c.code,templateContent:c.body,inspectionStatus:'APR',serviceStatus:'A',buttons:[{type:'WL',name:c.button,linkMobile:'https://www.petmanager.co.kr/book/manage?t=#{예약관리토큰}',linkPc:'https://www.petmanager.co.kr/book/manage?t=#{예약관리토큰}'}],...patch};
 globalThis.__depositMappingAdmin={from:()=>({select(){return this},eq(){return this},async maybeSingle(){return {data:{id:'fixture-mapping',provider_template_code:detail.templateCode,template_content:detail.templateContent,buttons:detail.buttons,variable_bindings:{}},error:null}}})};
 globalThis.fetch=async(url,init)=>{assert.equal(new URL(url).hostname,'relay.fixture.invalid');assert.equal(init.method,'GET');return Response.json({items:[{alias,configuredCode:detail.templateCode,detail}],allTemplates:[detail]});};
}
for(const alias of Object.keys(contracts))test(alias+' resolves exact approved version, variables and signed-booking CTA',async()=>{
 catalog(alias);const t=await getApprovedSsodaaNotificationTemplate(alias,variables);assert.equal(t.templateCode,contracts[alias].code);assert.equal(t.source,'ssodaa_approved');assert.ok(!/#\{/.test(t.body));assert.equal(isSameBookingManageLink(t.buttons[0].linkMobile,variables['예약 확인 링크']),true);
});
test('pending review and stopped templates never render as approved delivery',async()=>{
 catalog('booking_deposit_request',{inspectionStatus:'REQ'});await assert.rejects(getApprovedSsodaaNotificationTemplate('booking_deposit_request',variables));
 catalog('booking_deposit_request',{serviceStatus:'S'});await assert.rejects(getApprovedSsodaaNotificationTemplate('booking_deposit_request',variables));
});
test('an explicitly connected approved provider code may change but old wording or missing buttons are blocked',async()=>{
 catalog('booking_deposit_request',{templateCode:'new_explicitly_mapped_code'});assert.equal((await getApprovedSsodaaNotificationTemplate('booking_deposit_request',variables)).templateCode,'new_explicitly_mapped_code');
 catalog('booking_deposit_request',{templateCode:'booking_deposit_request',templateContent:legacy.booking_deposit_request.body});await assert.rejects(getApprovedSsodaaNotificationTemplate('booking_deposit_request',variables));
 catalog('booking_deposit_refunded',{buttons:[]});await assert.rejects(getApprovedSsodaaNotificationTemplate('booking_deposit_refunded',variables));
});
test('refund notification cannot link to another booking',async()=>{
 catalog('booking_deposit_refunded',{buttons:[{type:'WL',name:'예약 확인',linkMobile:'https://www.petmanager.co.kr/book/manage?t=other-booking'}]});await assert.rejects(getApprovedSsodaaNotificationTemplate('booking_deposit_refunded',variables),/일치하지 않아/);
});
