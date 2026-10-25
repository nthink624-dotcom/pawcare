import {alimtalkStorageFixture,uncachedCatalogFixture} from '../helpers/alimtalk-storage-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
let privateRows=[],registryOverrides=[];
let mappings=[],catalog={},failRPC=false,rpcCalls=0,adminAllowed=true;
const clone=value=>structuredClone(value);
class Query{
  constructor(){this.filters=[];} select(){return this;}or(){this.filters.push(r=>r.service_status==='active'||['requested','reviewing','unknown','pending'].includes(r.inspection_status));return this;} order(){return this;} limit(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}neq(k,v){this.filters.push(r=>r[k]!==v);return this;}
  async read(single=false){const result=mappings.filter(r=>this.filters.every(f=>f(r)));return {data:clone(single?result[0]??null:result),error:null};}
  maybeSingle(){return this.read(true);}then(r,j){return this.read().then(r,j);}
}
const admin={from:table=>alimtalkStorageFixture(table,()=>({platform:mappings,requests:privateRows,registry:registryOverrides}))??new Query(),rpc:async(name,p)=>{
  assert.equal(name,'replace_platform_alimtalk_template');rpcCalls++;
  const prior=mappings.find(r=>r.template_alias===p.p_alias&&r.service_status==='active');
  if(failRPC||prior?.id!==(p.p_expected_current??undefined)||prior?.updated_at!==(p.p_expected_updated_at??undefined))return {data:null,error:{code:'40001'}};
  const next={id:'00000000-0000-4000-8000-000000000002',provider:'ssodaa',template_alias:p.p_alias,provider_template_code:p.p_template.templateCode,template_name:p.p_template.templateName,template_content:p.p_template.templateContent,buttons:p.p_template.buttons,variable_bindings:p.p_bindings,inspection_status:'approved',service_status:'active',updated_at:'2026-10-21T01:00:00Z'};
  if(prior)prior.service_status='inactive';mappings.push(next);return {data:clone(next),error:null};
}};
globalThis.__templateMappingTest={admin,allowed:()=>adminAllowed};
registerHooks({resolve(s,c,next){
  if(s==='@/server/alimtalk-provider-catalog-cache')return stub(uncachedCatalogFixture);

  if(s==='@/server/observability')return stub('export const logOperationalEvent=()=>{};');
  if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__templateMappingTest.admin;');
  if(s==='@/lib/server-env')return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"mock-only"};export const getConfiguredAlimtalkTemplateKey=()=>"old_env_code";');
  if(s==='@/server/admin-api-auth')return stub('export class AdminApiError extends Error{constructor(m,s){super(m);this.status=s}}export const requireAdminSession=async()=>{if(!globalThis.__templateMappingTest.allowed())throw new AdminApiError("관리자 권한 필요",403)}');
  return next(s,c);
}});
const {GET,PUT}=await import('../../src/app/api/admin/alimtalk/template-mapping/route.ts');
const {getApprovedSsodaaNotificationTemplate}=await import('../../src/server/alimtalk-approved-template.ts');
const {DEPOSIT_ALIMTALK_REVIEW_CONTRACTS:fixedDeposit}=await import('@petmanager/shared/contracts/deposit-alimtalk-review');
const oldId='00000000-0000-4000-8000-000000000001',oldAt='2026-10-20T00:00:00Z';
const values={'보호자명':'김민수','반려동물명':'보리','예약 확인 링크':'https://www.petmanager.co.kr/m?t=fixture'};
function reset(){privateRows=[];registryOverrides=[];failRPC=false;rpcCalls=0;adminAllowed=true;
  const a={templateCode:'code_A',templateName:'템플릿명 A',templateContent:'#{보호자명}님, 미용을 시작했어요.',inspectionStatus:'APR',serviceStatus:'A',buttons:[]};
  const d={templateCode:'code_D',templateName:'이름으로 용도를 판단할 수 없음',templateContent:'#{고객이름}님, #{아이이름} 미용 중이에요.',inspectionStatus:'APR',serviceStatus:'A',buttons:[{type:'WL',name:'진행 확인',linkMobile:'#{안내링크}',linkPc:'#{안내링크}'}]};
  catalog={items:[{alias:'grooming_started',configuredCode:'old_env_code',detail:a}],allTemplates:[a,d]};
  mappings=[{id:oldId,provider:'ssodaa',template_alias:'grooming_started',provider_template_code:a.templateCode,template_name:a.templateName,template_content:a.templateContent,buttons:a.buttons,variable_bindings:{},inspection_status:'approved',service_status:'active',updated_at:oldAt}];
  globalThis.fetch=async(url,init)=>{assert.equal(new URL(url).hostname,'relay.fixture.invalid');assert.equal(init.method,'GET');return Response.json(catalog)};
}
const bindings={'고객이름':'보호자명','아이이름':'반려동물명','안내링크':'예약 확인 링크'};
function request(patch={}){return new Request('http://127.0.0.1/api/admin/alimtalk/template-mapping',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify({templateAlias:'grooming_started',templateCode:'code_D',variableBindings:bindings,expectedCurrentId:oldId,expectedUpdatedAt:oldAt,...patch})});}
const render=()=>getApprovedSsodaaNotificationTemplate('grooming_started',values);
test('stable notification alias changes A to unrelated name/code D, and uses its actual body/buttons/variables',async()=>{
  reset();assert.equal((await render()).templateCode,'code_A');assert.equal((await PUT(request())).status,200);
  const sent=await render();assert.equal(sent.templateAlias,'grooming_started');assert.equal(sent.templateCode,'code_D');assert.equal(sent.body,'김민수님, 보리 미용 중이에요.');assert.equal(sent.buttons[0].name,'진행 확인');assert.equal(sent.buttons[0].linkMobile,values['예약 확인 링크']);assert.equal(mappings.filter(r=>r.service_status==='active').length,1);
  const view=await(await GET(new Request('http://127.0.0.1/api/admin/alimtalk/template-mapping'))).json();const current=view.notificationMappings.find(r=>r.alias==='grooming_started');assert.equal(current.templateCode,'code_D');assert.equal(current.usable,true);assert.equal(current.source,'platform');
});
test('pending/rejected/stopped/deleted replacements cannot displace the active connection',async()=>{
  for(const patch of [{inspectionStatus:'REQ'},{inspectionStatus:'REJ'},{inspectionStatus:'ING'},{serviceStatus:'S'},{serviceStatus:'deleted'}]){reset();Object.assign(catalog.allTemplates[1],patch);assert.notEqual((await PUT(request())).status,200);assert.equal(rpcCalls,0);assert.equal((await render()).templateCode,'code_A');}
});
test('unknown variable binding blocks apply; missing runtime value blocks send without dropping a token',async()=>{
  reset();assert.notEqual((await PUT(request({variableBindings:{}}))).status,200);assert.equal(rpcCalls,0);
  assert.equal((await PUT(request())).status,200);const before=values['반려동물명'];delete values['반려동물명'];try{await assert.rejects(render(),/필요한 예약 정보/)}finally{values['반려동물명']=before;}
});
test('RPC failure or stale concurrent apply preserves the prior mapping and never makes two active connections',async()=>{
  reset();failRPC=true;assert.equal((await PUT(request())).status,409);assert.equal((await render()).templateCode,'code_A');assert.equal(mappings.length,1);
  reset();const replies=await Promise.all([PUT(request()),PUT(request())]);assert.deepEqual(replies.map(r=>r.status).sort(),[200,409]);assert.equal(mappings.filter(r=>r.service_status==='active').length,1);
});
test('no DB connection never falls back to a stale environment/relay code; provider drift is shown as blocked',async()=>{
  reset();mappings=[];await assert.rejects(render(),/승인 상태와 본문/);const empty=await(await GET(new Request('http://127.0.0.1/api/admin/alimtalk/template-mapping'))).json();assert.equal(empty.notificationMappings.find(r=>r.alias==='grooming_started').source,'none');
  reset();catalog.allTemplates[0].templateContent='관리자 연결 이후 쏘다에서 바뀐 내용';await assert.rejects(render(),/본문·버튼이 달라/);const drift=await(await GET(new Request('http://127.0.0.1/api/admin/alimtalk/template-mapping'))).json();assert.equal(drift.notificationMappings.find(r=>r.alias==='grooming_started').usable,false);
});
test('provider name alone can change without changing PetManager notification identity; non-admin cannot map',async()=>{
  reset();catalog.allTemplates[0].templateName='다른 템플릿 이름';assert.equal((await render()).templateName,'다른 템플릿 이름');adminAllowed=false;assert.equal((await PUT(request())).status,403);assert.equal(rpcCalls,0);
});
test('deposit provider code may be explicitly changed only with exact mandatory text/buttons and unchanged variable semantics',async()=>{
  reset();const c=fixedDeposit.booking_deposit_request;
  const changed={templateCode:'deposit_code_D',templateName:'이름과 코드만 변경',templateContent:c.body,inspectionStatus:'APR',serviceStatus:'A',buttons:[{type:'WL',name:c.button,linkMobile:'https://www.petmanager.co.kr/m?t=#{예약관리토큰}'}]};catalog.allTemplates.push(changed);
  const payload={templateAlias:'booking_deposit_request',templateCode:changed.templateCode,variableBindings:{},expectedCurrentId:null,expectedUpdatedAt:null};
  assert.equal((await PUT(request(payload))).status,200);
  assert.notEqual((await PUT(request({...payload,variableBindings:{'예약금액':'보호자명'}}))).status,200);
  changed.templateContent+=' 변경된 환불 조건';assert.notEqual((await PUT(request(payload))).status,200);
});

const {sendAlimtalkMessage}=await import('../../src/server/alimtalk-provider.ts');
test('private code cannot be published globally by admin, including after owner request deletion',async()=>{
 reset();privateRows=[{shop_id:'private-a',template_alias:'grooming_started',template_code:'code_D'}];
 const response=await PUT(request());assert.equal(response.status,400);assert.equal(rpcCalls,0);assert.equal(mappings[0].provider_template_code,'code_A');
 privateRows=[];registryOverrides=[{template_code:'code_D',scope:'shop',owner_shop_id:null,retired_at:'2026-10-25T00:00:00Z'}];
 assert.equal((await PUT(request())).status,400);assert.equal(rpcCalls,0);
});
test('corrupt legacy public mapping to private owner code blocks runtime and final transport without a send',async()=>{
 reset();privateRows=[{shop_id:'private-a',template_alias:'grooming_started',template_code:'code_D'}];
 const d=catalog.allTemplates[1];Object.assign(mappings[0],{provider_template_code:d.templateCode,template_content:d.templateContent,buttons:d.buttons,variable_bindings:bindings});
 let sends=0;const previous=globalThis.fetch;globalThis.fetch=async(...args)=>{if(args[1]?.method==='POST')sends++;return previous(...args);};
 await assert.rejects(getApprovedSsodaaNotificationTemplate('grooming_started',values,null,'different-b'));
 await assert.rejects(sendAlimtalkMessage({shopId:'different-b',templateKey:'code_D',message:'fixture',to:'01000000000'}));
 assert.equal(sends,0);
});
