import {alimtalkStorageFixture,uncachedCatalogFixture} from '../helpers/alimtalk-storage-fixture.mjs';
import assert from 'node:assert/strict';import test from 'node:test';import {registerHooks} from 'node:module';
let tables,provider,shop='a',user='00000000-0000-4000-8000-000000000001',role='owner',failCAS=false;
const clone=x=>structuredClone(x),stub=c=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(c)});
class Query{constructor(t){this.t=t;this.filters=[];}select(){return this;}or(){this.filters.push(r=>r.service_status==='active'||['requested','reviewing','unknown','pending'].includes(r.inspection_status));return this;}update(values){this.values=values;return this;}range(from,to){this.slice=[from,to];return this;}order(){return this;}eq(k,v){this.filters.push(r=>r[k]===v);return this;}in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}async read(one=false){let a=(tables[this.t]||[]).filter(r=>this.filters.every(f=>f(r)));if(this.values)a.forEach(row=>Object.assign(row,this.values));if(this.slice)a=a.slice(this.slice[0],this.slice[1]+1);return {data:clone(one?a[0]??null:a),error:null};}maybeSingle(){return this.read(true);}then(r,j){return this.read().then(r,j);}}
const admin={from:t=>alimtalkStorageFixture(t,()=>({requests:tables.shop_alimtalk_template_requests,platform:tables.platform_alimtalk_templates,selected:tables.shop_alimtalk_template_selections}))??new Query(t),rpc:async(name,p)=>{
  if(name==='read_shop_alimtalk_approval'){const n=tables.shop_alimtalk_approval_notices.find(r=>r.id===p.p_notice&&r.shop_id===p.p_shop);if(n&&!n.read_by.includes(p.p_user))n.read_by.push(p.p_user);return {data:!!n,error:null};}
  assert.equal(name,'observe_shop_alimtalk_approvals','approval must never invoke activation');
  let cursor=tables.shop_alimtalk_approval_sync.find(r=>r.shop_id===p.p_shop);if(!cursor){cursor={shop_id:p.p_shop,version:0,observed:{}};tables.shop_alimtalk_approval_sync.push(cursor);}
  if(failCAS||cursor.version!==p.p_expected_version)return {error:{code:'40001'}};
  for(const item of p.p_snapshot){const key=item.alias+':'+item.code;if(item.fingerprint&&cursor.observed[key]!==item.fingerprint){if(cursor.version>0&&!tables.shop_alimtalk_approval_notices.some(n=>n.shop_id===p.p_shop&&n.template_alias===item.alias&&n.template_code===item.code&&n.fingerprint===item.fingerprint))tables.shop_alimtalk_approval_notices.push({id:'00000000-0000-4000-8000-'+String(tables.shop_alimtalk_approval_notices.length+10).padStart(12,'0'),shop_id:p.p_shop,template_alias:item.alias,template_code:item.code,fingerprint:item.fingerprint,created_at:new Date().toISOString(),read_by:[]});cursor.observed[key]=item.fingerprint;}else cursor.observed[key]=item.fingerprint??null;}cursor.observed=Object.fromEntries(p.p_snapshot.map(item=>[item.alias+':'+item.code,item.fingerprint??null]));cursor.version++;return {error:null};
}};
globalThis.__approval={admin,auth:s=>{if(s&&s!==shop){const e=new Error('다른 매장');e.status=403;throw e;}return {shopId:shop,userId:user,role}}};
registerHooks({resolve(s,c,next){
  if(s==='@/server/alimtalk-provider-catalog-cache')return stub(uncachedCatalogFixture);
if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__approval.admin;');if(s==='@/lib/server-env')return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"fixture"};export const getConfiguredAlimtalkTemplateKey=()=>null;');if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(m,s=400){super(m);this.status=s}}export const requireOwnerShop=async(r,s)=>{try{return globalThis.__approval.auth(s)}catch(e){throw new OwnerApiError(e.message,e.status)}};export const assertOwnerOrManager=o=>{if(!["owner","manager"].includes(o.role))throw new OwnerApiError("권한",403)};');return next(s,c);}});
globalThis.fetch=async()=>Response.json({allTemplates:provider});
const{GET,PATCH}=await import('../../src/app/api/owner/alimtalk-approval-notices/route.ts');
const{readAlimtalkApprovalNotices,syncShopAlimtalkApprovals}=await import('../../src/server/alimtalk-approval-notices.ts');
const alias='grooming_started',code='code_D';
const detail=()=>({templateCode:code,templateName:'이름으로 종류를 추정할 수 없는 문구',templateContent:'#{보호자명}님, 미용을 시작했어요.',buttons:[],inspectionStatus:'REQ',serviceStatus:'A'});
function reset(){shop='a';role='owner';user='00000000-0000-4000-8000-000000000001';failCAS=false;provider=[detail()];tables={shop_alimtalk_approval_sync:[],shop_alimtalk_approval_notices:[],shop_alimtalk_template_requests:[{shop_id:'a',template_alias:alias,template_code:code,template_content:provider[0].templateContent,template_buttons:[],inspection_status:'requested',service_status:'a'}],platform_alimtalk_templates:[],shop_alimtalk_template_selections:[{shop_id:'a',template_alias:alias,template_code:'old-code'}]};}
const read=async()=>{await syncShopAlimtalkApprovals(shop);return readAlimtalkApprovalNotices(shop,user);};

test('owner polling reads saved approval state without contacting the provider',async()=>{
  reset();provider[0].inspectionStatus='APR';await syncShopAlimtalkApprovals(shop);
  assert.equal(tables.shop_alimtalk_template_requests[0].inspection_status,'approved');
  const original=globalThis.fetch;globalThis.fetch=async()=>{throw Error('provider must not be called by owner polling');};
  try{const response=await GET(new Request('http://fixture/api?shopId=a'));assert.equal(response.status,200);assert.equal((await response.json()).notices.length,1);}finally{globalThis.fetch=original;}
});
test('revoked approval disappears after server observation without changing owner selection',async()=>{
  reset();provider[0].inspectionStatus='APR';assert.equal((await read()).length,1);
  provider[0].serviceStatus='S';await syncShopAlimtalkApprovals(shop);
  assert.equal((await readAlimtalkApprovalNotices(shop,user)).length,0);
  assert.equal(tables.shop_alimtalk_template_selections[0].template_code,'old-code');
});
test('pending→APR creates one correctly typed approval; service readiness alone never approves',async()=>{reset();assert.deepEqual(await read(),[]);provider[0].inspectionStatus='APR';const notices=await read();assert.equal(notices.length,1);assert.equal(notices[0].title,'미용 시작 문구가 승인됐어요');assert.equal(notices[0].templateAlias,alias);assert.equal(notices[0].templateCode,code);assert.equal((await read()).length,1);assert.equal(tables.shop_alimtalk_approval_notices.length,1);});
test('first approved owner submission is announced; repeated observations do not spam',async()=>{reset();provider[0].inspectionStatus='APR';assert.equal((await read()).length,1);provider[0].templateName='새 이름';assert.equal((await read()).length,1);provider[0].serviceStatus='S';await read();provider[0].serviceStatus='A';assert.equal((await read()).length,1);});

test('an approved revision of an explicitly registered platform code alerts without applying its changed snapshot',async()=>{
  reset();provider[0].inspectionStatus='APR';tables.shop_alimtalk_template_requests=[];
  tables.platform_alimtalk_templates=[{provider:'ssodaa',template_alias:alias,provider_template_code:code,template_content:provider[0].templateContent,buttons:[],variable_bindings:{},inspection_status:'approved',service_status:'active'}];
  assert.deepEqual(await read(),[]);
  const before=clone(tables.shop_alimtalk_template_selections);
  provider[0].templateContent='#{보호자명}님, 새로 승인된 미용 시작 문구입니다.';
  provider[0].buttons=[{type:'WL',name:'새 예약 확인',linkMobile:'#{예약 확인 링크}'}];
  const notices=await read();assert.equal(notices.length,1);assert.equal(notices[0].templateAlias,alias);assert.equal(notices[0].templateCode,code);
  assert.equal((await read()).length,1);assert.deepEqual(tables.shop_alimtalk_template_selections,before);
  assert.notEqual(tables.platform_alimtalk_templates[0].template_content,provider[0].templateContent,'approval observation must not rewrite the active mapping');
  const approvedBody=provider[0].templateContent;
  provider[0].inspectionStatus='REJ';assert.deepEqual(await read(),[]);
  provider[0].inspectionStatus='APR';provider[0].serviceStatus='STOP';assert.deepEqual(await read(),[]);
  provider[0].serviceStatus='A';provider[0].templateContent='#{unknown}';assert.deepEqual(await read(),[]);
  provider[0].templateContent=approvedBody;assert.equal((await read()).length,1);
});
test('read receipts persist per owner and cannot change active selections or mark another shop read',async()=>{reset();await read();provider[0].inspectionStatus='APR';const [n]=await read(),before=clone(tables.shop_alimtalk_template_selections);const response=await PATCH(new Request('http://fixture/api',{method:'PATCH',body:JSON.stringify({shopId:'a',noticeId:n.id})}));assert.equal(response.status,200);assert.deepEqual(await read(),[]);assert.deepEqual(tables.shop_alimtalk_template_selections,before);user='00000000-0000-4000-8000-000000000002';assert.equal((await read()).length,1);shop='b';assert.equal((await PATCH(new Request('http://fixture/api',{method:'PATCH',body:JSON.stringify({shopId:'b',noticeId:n.id})}))).status,404);});
test('rejected/stopped/deleted, private foreign templates, unknown variables and drift cannot alert',async()=>{reset();await read();for(const status of ['REQ','ING','REJ']){provider[0].inspectionStatus=status;assert.deepEqual(await read(),[]);}provider[0].inspectionStatus='APR';provider[0].serviceStatus='S';assert.deepEqual(await read(),[]);provider[0].serviceStatus='DELETED';assert.deepEqual(await read(),[]);provider[0].serviceStatus='A';provider[0].templateContent='다른 원문';assert.deepEqual(await read(),[]);provider[0]=detail();provider[0].inspectionStatus='APR';tables.shop_alimtalk_template_requests[0].shop_id='b';assert.deepEqual(await read(),[]);});
test('shared registered alias broadcasts once per eligible shop, never by provider name',async()=>{reset();tables.shop_alimtalk_template_requests=[];tables.platform_alimtalk_templates=[{provider:'ssodaa',template_alias:alias,provider_template_code:code,template_content:provider[0].templateContent,buttons:[],variable_bindings:{},inspection_status:'requested',service_status:'inactive'}];await read();shop='b';await read();provider[0].inspectionStatus='APR';assert.equal((await read()).length,1);shop='a';assert.equal((await read()).length,1);assert.equal(tables.shop_alimtalk_approval_notices.length,2);});
test('old concurrent observation is rejected and cross-shop/staff APIs are denied',async()=>{reset();await read();provider[0].inspectionStatus='APR';failCAS=true;await assert.rejects(read());assert.equal(tables.shop_alimtalk_approval_notices.length,0);assert.equal((await GET(new Request('http://fixture/api?shopId=b'))).status,403);role='staff';assert.equal((await GET(new Request('http://fixture/api?shopId=a'))).status,403);});
test('concurrent initial/approval reads refresh a known CAS conflict once and return the same single notice',async()=>{reset();await Promise.all([read(),read()]);provider[0].inspectionStatus='APR';const [a,b]=await Promise.all([read(),read()]);assert.equal(a.length,1);assert.equal(b.length,1);assert.equal(a[0].id,b[0].id);assert.equal(tables.shop_alimtalk_approval_notices.length,1);});
