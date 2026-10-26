import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { DEFAULT_BOOKING_POLICY } from '@petmanager/shared/contracts/booking-preparation';
import { canRetryConsentRequest } from '@petmanager/shared/lib/booking-consent-guidance';

const ids={guardian:'00000000-0000-4000-8000-000000000001',pet:'00000000-0000-4000-8000-000000000002',appointment:'00000000-0000-4000-8000-000000000003',doc:'00000000-0000-4000-8000-000000000004',user:'00000000-0000-4000-8000-000000000005'};
let tables,documents,available,outcome,role,sends,rpcs;
const clone=v=>structuredClone(v),stub=s=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(s)});
class Query {
  constructor(table){this.table=table;this.filters=[];}
  select(){return this;} order(){return this;} limit(){return this;}
  eq(key,value){this.filters.push(row=>row[key]===value);return this;}
  contains(key,value){this.filters.push(row=>JSON.stringify(row[key]).includes(JSON.stringify(value)));return this;}
  async read(one=false){const rows=(tables[this.table]??[]).filter(row=>this.filters.every(f=>f(row)));return{data:clone(one?rows[0]??null:rows),count:rows.length,error:null};}
  maybeSingle(){return this.read(true);} single(){return this.read(true);} then(a,b){return this.read().then(a,b);}
}
const admin={from:table=>new Query(table),rpc:async(name,p)=>{
  rpcs.push({name,p:clone(p)});
  if(name==='pm_deposit_available')return{data:clone(available),error:null};
  if(name==='save_booking_preparation'){
    const row=tables.booking_preparations[0];
    if(row.version!==p.p_version)return{error:{message:'VERSION_CONFLICT'}};
    row.data=clone(p.p_data);row.version++;return{data:row.version,error:null};
  }
  if(name==='pm_record_consent_recognitions'){
    if(p.p_documents.some(chosen=>!documents.some(doc=>doc.id===chosen.id&&doc.version===chosen.version&&doc.scope==='pet')))return{error:{message:'CONSENT_DOCUMENT_CHANGED'}};
    for(const chosen of p.p_documents){const doc=documents.find(doc=>doc.id===chosen.id);doc.status='recognized';doc.recognizedBy=p.p_actor;doc.recognizedAt=new Date().toISOString();}
    return{data:{},error:null};
  }
  throw Error('unexpected RPC '+name);
}};
globalThis.__consentDetail={admin,state:()=>({enabled:true,policyVersion:1,documents:clone(documents)}),dispatch:async input=>{sends.push(input);if(outcome==='throw')throw Error('transport unknown');return{notification:{status:outcome,fail_reason:outcome==='failed'?'Recipient phone number not found.':null}};},auth:shop=>({shopId:shop??'fixture',userId:ids.user,role})};
registerHooks({resolve(s,c,next){
  if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__consentDetail.admin;');
  if(s==='@/server/customer-consent-state')return stub('export const readCustomerConsentState=async()=>globalThis.__consentDetail.state();');
  if(s==='@/server/notification-dispatch')return stub('export const dispatchNotification=async input=>globalThis.__consentDetail.dispatch(input);');
  if(s==='@/server/booking-access-token')return stub('export const createBookingAccessToken=()=>"fixture-token";export const verifyBookingAccessToken=()=>({});');
  if(s==='@/server/booking-deposit-ledger')return stub('export const readDepositLedger=async()=>null;export const isLedgerAction=()=>false;export const actOnDepositLedger=async()=>{};export const flushDepositOutbox=async()=>{};export const readDepositRetryDelivery=async()=>({});');
  if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(m,status=400){super(m);this.status=status}}export const requireOwnerShop=async(r,shop)=>{if(shop&&shop!=="fixture")throw new OwnerApiError("다른 매장",403);return globalThis.__consentDetail.auth(shop)};export const assertOwnerOrManager=owner=>{if(!["owner","manager"].includes(owner.role))throw new OwnerApiError("권한",403)};');
  return next(s,c);
}});
const {getPreparation,actOnPreparation}=await import('../../src/server/booking-preparation.ts');
const {POST}=await import('../../src/app/api/owner/customer-consents/route.ts');
function reset(){
  documents=[{id:ids.doc,version:1,title:'미용 동의서',body:'고객 확인 내용',scope:'pet',required:true,enabled:true,status:'pending'}];
  const policy={...clone(DEFAULT_BOOKING_POLICY),consentBeforeStart:true,templates:clone(documents)};
  const data={policyVersion:1,policy,guardianName:'김민수',petName:'보리',deposit:{status:'not_requested',required:false,amount:20000,receivedAmount:0,refundedAmount:0,dueAt:null,payerName:'',reportedAt:null,confirmedAt:null,confirmedBy:null},consents:clone(documents),cancellation:null,history:[],requests:[]};
  tables={appointments:[{id:ids.appointment,shop_id:'fixture',guardian_id:ids.guardian,pet_id:ids.pet,status:'confirmed',start_at:'2030-01-02T00:00:00Z',end_at:'2030-01-02T01:00:00Z',appointment_date:'2030-01-02',appointment_time:'09:00:00',service_id:'service',staff_id:'staff',memo:'',final_service_price:null}],booking_preparations:[{shop_id:'fixture',appointment_id:ids.appointment,guardian_id:ids.guardian,pet_id:ids.pet,version:1,data}],shop_booking_policies:[{shop_id:'fixture',policy,version:1}],guardians:[{id:ids.guardian,shop_id:'fixture',notification_settings:{enabled:true,consent_request_enabled:true}}],shops:[{id:'fixture',notification_settings:{enabled:true}}],guardian_booking_conditions:[],booking_deposit_events:[]};
  role='owner';available=[];outcome='sent';sends=[];rpcs=[];
}
const current=()=>getPreparation('fixture',ids.appointment,true),actor={kind:'owner',userId:ids.user};
const act=async()=>{const state=await current();return actOnPreparation(state,{action:'request_guidance',version:state.version,consent:true,deposit:false},actor);};
const recognize=body=>POST(new Request('http://fixture/api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({shopId:'fixture',guardianId:ids.guardian,petId:ids.pet,policyVersion:1,confirmedExistingConsent:true,...body})}));

test('summary loads scoped other-date usable balances without long history, and reports current consent metadata',async()=>{
  reset();available=[{id:'other',date:'2030-01-01',available:5000}];const state=await current();
  assert.deepEqual(state.availableDeposits,available);assert.equal(rpcs.filter(r=>r.name==='pm_deposit_available').length,1);
  assert.deepEqual(state.consentStatus.pendingDocuments,[{id:ids.doc,version:1,title:'미용 동의서',scope:'pet'}]);assert.equal(state.serviceAmount,null);assert.equal(state.remainingAmount,null);
});
test('global OFF and customer consent opt-out have distinct visible block reasons; reading never sends',async()=>{
  reset();tables.shops[0].notification_settings.enabled=false;assert.match((await current()).consentStatus.deliveryBlockReason,/매장/);
  tables.shops[0].notification_settings.enabled=true;tables.guardians[0].notification_settings.consent_request_enabled=false;assert.match((await current()).consentStatus.deliveryBlockReason,/고객/);assert.equal(sends.length,0);
});
test('explicit retry retains failed history, requests once, and does not sign or change booking/payment state',async()=>{
  reset();tables.booking_preparations[0].data.requests.push({id:'old',at:new Date().toISOString(),purposes:['consent'],status:'failed',reason:'보호자 연락처가 없습니다. 번호를 등록한 뒤 다시 요청해 주세요.'});
  const next=await act();assert.equal(sends.length,1);assert.equal(next.data.requests.length,2);assert.equal(next.data.requests[0].id,'old');assert.equal(next.data.requests.at(-1).status,'sent');assert.equal(next.consentStatus.pendingCount,1);assert.equal(next.data.consents[0].status,'pending');assert.equal(next.appointmentStatus,'confirmed');assert.equal(next.data.deposit.receivedAmount,0);
  await assert.rejects(act(),/이미 보냈거나/);assert.equal(sends.length,1);
});
test('concurrent explicit requests claim the preparation version before sending',async()=>{
  reset();const state=await current();const input={action:'request_guidance',version:state.version,consent:true};
  const outcomes=await Promise.allSettled([actOnPreparation(clone(state),input,actor),actOnPreparation(clone(state),input,actor)]);
  assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);assert.equal(sends.length,1);
});
test('unknown dispatch outcome remains unconfirmed and cannot be resent',async()=>{
  reset();outcome='throw';const next=await act();assert.equal(next.data.requests.at(-1).status,'sending');assert.equal(next.data.requests.at(-1).retrySafe,false);
  await assert.rejects(act(),/발송 결과/);assert.equal(sends.length,1);
  for(const status of ['sending','queued','sent'])assert.equal(canRetryConsentRequest({status,reason:'',retrySafe:false}),false);
  assert.equal(canRetryConsentRequest({status:'failed',reason:'timeout'}),false);assert.equal(canRetryConsentRequest({status:'blocked',reason:'수신 거부'}),true);
});
test('customer cannot request guidance and owner cannot fake a customer signature',async()=>{
  reset();const state=await current();await assert.rejects(actOnPreparation(state,{action:'request_guidance',version:1,consent:true},{kind:'customer',userId:null}),/권한/);
  await assert.rejects(actOnPreparation(state,{action:'sign',version:1},actor),/보호자가 직접/);assert.equal(sends.length,0);
});
test('existing single recognition and new explicit batch use the same RPC; never synthesize signatures',async()=>{
  reset();assert.equal((await recognize({templateId:ids.doc,templateVersion:1})).status,200);assert.equal(documents[0].status,'recognized');assert.equal(documents[0].signature,undefined);assert.equal(documents[0].recognizedBy,ids.user);
  reset();assert.equal((await recognize({documents:[{id:ids.doc,version:1}]})).status,200);assert.equal(documents[0].status,'recognized');assert.equal(rpcs.at(-1).name,'pm_record_consent_recognitions');assert.equal(sends.length,0);
});
test('recognition requires owner, explicit confirmation, same shop and current pet-level documents',async()=>{
  reset();role='manager';assert.equal((await recognize({documents:[{id:ids.doc,version:1}]})).status,403);role='owner';
  assert.equal((await recognize({shopId:'other',documents:[{id:ids.doc,version:1}]})).status,403);
  assert.equal((await recognize({confirmedExistingConsent:false,documents:[{id:ids.doc,version:1}]})).status,400);
  assert.equal((await recognize({templateId:ids.doc,templateVersion:1,documents:[{id:ids.doc,version:1}]})).status,400);
  documents[0].scope='appointment';assert.equal((await recognize({documents:[{id:ids.doc,version:1}]})).status,409);assert.equal(documents[0].status,'pending');
});
