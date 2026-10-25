import {alimtalkStorageFixture,uncachedCatalogFixture} from '../helpers/alimtalk-storage-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
let selected=[],requests=[],platform=[],catalog=[],fail=false,role='owner',actorShop='shop-a';
class Query{
  constructor(table){this.table=table;this.filters=[];}select(){return this;}or(){this.filters.push(r=>r.service_status==='active'||['requested','reviewing','unknown','pending'].includes(r.inspection_status));return this;}range(from,to){this.slice=[from,to];return this;}order(){return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;}in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}
  async read(single=false){const table=this.table==='shop_alimtalk_template_selections'?selected:this.table==='shop_alimtalk_template_requests'?requests:platform;let rows=table.filter(r=>this.filters.every(f=>f(r)));if(this.slice)rows=rows.slice(this.slice[0],this.slice[1]+1);return {data:structuredClone(single?rows[0]??null:rows),error:null};}
  maybeSingle(){return this.read(true);}then(r,j){return this.read().then(r,j);}
}
const admin={from:t=>alimtalkStorageFixture(t,()=>({requests,platform,selected}))??new Query(t),rpc:async(n,p)=>{
  assert.equal(n,'set_shop_alimtalk_template_selection');const old=selected.find(r=>r.shop_id===p.p_shop&&r.template_alias===p.p_alias);
  if(fail||(old?.version??0)!==p.p_expected_version)return {data:null,error:{code:'40001'}};
  const row={shop_id:p.p_shop,template_alias:p.p_alias,template_code:p.p_template.templateCode,template_name:p.p_template.templateName,template_content:p.p_template.templateContent,template_buttons:p.p_template.buttons,variable_bindings:p.p_bindings,version:(old?.version??0)+1};
  selected=selected.filter(r=>r!==old);selected.push(row);return {data:structuredClone(row),error:null};
}};
globalThis.__ownerSelection={admin,auth:async(shop)=>{if(shop&&shop!==actorShop){const e=new Error('다른 매장');e.status=403;throw e;}return {shopId:actorShop,userId:'00000000-0000-4000-8000-000000000001',role}},assert:owner=>{if(!['owner','manager'].includes(owner.role)){const e=new Error('권한');e.status=403;throw e}}};
registerHooks({resolve(s,c,next){
  if(s==='@/server/alimtalk-provider-catalog-cache')return stub(uncachedCatalogFixture);

  if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__ownerSelection.admin;');
  if(s==='@/lib/server-env')return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"fixture"};export const getConfiguredAlimtalkTemplateKey=()=>"old_env";');
  if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(m,s=400){super(m);this.status=s}}export async function requireOwnerShop(r,s){try{return await globalThis.__ownerSelection.auth(s)}catch(e){throw new OwnerApiError(e.message,e.status)}}export const assertOwnerOrManager=o=>{try{globalThis.__ownerSelection.assert(o)}catch(e){throw new OwnerApiError(e.message,e.status)}}');
  return next(s,c);
}});
globalThis.fetch=async()=>Response.json({allTemplates:catalog});
const {GET,PUT}=await import('../../src/app/api/owner/alimtalk-template-selection/route.ts');
const {getApprovedSsodaaNotificationTemplate}=await import('../../src/server/alimtalk-approved-template.ts');
const values={'보호자명':'김민수','반려동물명':'보리','예약 확인 링크':'https://www.petmanager.co.kr/m?t=fixture'};
function reset(){selected=[];requests=[];platform=[];fail=false;role='owner';actorShop='shop-a';catalog=['A','D'].map(code=>({templateCode:code,templateName:'이름과 무관한 문구 '+code,templateContent:code+' #{보호자명}님, #{반려동물명} 미용 중이에요.',inspectionStatus:'APR',serviceStatus:'A',buttons:[{type:'WL',name:code+' 확인',linkMobile:'#{예약 확인 링크}'}]}));platform=catalog.map(t=>({provider:"ssodaa",service_status:"active",template_alias:"grooming_started",provider_template_code:t.templateCode,variable_bindings:{}}));}
const put=(code,expectedVersion=0,shopId=actorShop)=>PUT(new Request('http://fixture/api',{method:'PUT',body:JSON.stringify({shopId,templateAlias:'grooming_started',templateCode:code,expectedVersion})}));
const view=()=>GET(new Request('http://fixture/api?shopId='+actorShop));

test('an unknown provider template is not public even when 10,000 foreign requests precede this shop',async()=>{
  reset();platform=[];
  requests=Array.from({length:10_000},(_,i)=>({shop_id:'foreign-'+i,template_alias:'grooming_started',template_code:'foreign-'+i}));
  requests.push({shop_id:actorShop,template_alias:'grooming_started',template_code:'D',template_content:catalog[1].templateContent,template_buttons:catalog[1].buttons});
  const item=(await (await view()).json()).items.find(row=>row.alias==='grooming_started');
  assert.deepEqual(item.options.map(row=>row.code),['D']);
  assert.equal((await put('A')).status,409);assert.equal((await put('D')).status,200);
});
test('shop-owned request history is paged past 1,000 rows with exact alias and snapshot checks',async()=>{
  reset();platform=[];
  requests=Array.from({length:1_005},(_,i)=>({shop_id:actorShop,template_alias:'grooming_started',template_code:'old-'+i}));
  requests.push({shop_id:actorShop,template_alias:'grooming_started',template_code:'D',template_content:catalog[1].templateContent,template_buttons:catalog[1].buttons});
  assert.equal((await put('D')).status,200);
});
test('each owner selects for their shop; actual resolver uses the selected current code/body/button/variables',async()=>{
  reset();assert.equal((await put('D')).status,200);actorShop='shop-b';assert.equal((await put('A')).status,200);
  const a=await getApprovedSsodaaNotificationTemplate('grooming_started',values,null,'shop-a'),b=await getApprovedSsodaaNotificationTemplate('grooming_started',values,null,'shop-b');
  assert.equal(a.templateCode,'D');assert(a.body.includes('D 김민수님, 보리'));assert.equal(a.buttons[0].name,'D 확인');assert.equal(a.buttons[0].linkMobile,values['예약 확인 링크']);assert.equal(b.templateCode,'A');
});
test('new approval appears after refresh but cannot replace the explicit selection until owner saves',async()=>{
  reset();catalog[1].inspectionStatus='REQ';assert.equal((await put('A')).status,200);
  let item=(await (await view()).json()).items.find(r=>r.alias==='grooming_started');assert.equal(item.options.length,1);assert.equal((await put('D',1)).status,409);
  catalog[1].inspectionStatus='APR';item=(await (await view()).json()).items.find(r=>r.alias==='grooming_started');assert.equal(item.options.length,2);assert.equal(item.current.code,'A');
  assert.equal((await put('D',1)).status,200);assert.equal((await getApprovedSsodaaNotificationTemplate('grooming_started',values,null,actorShop)).templateCode,'D');
});
test('pending/rejected/stopped/deleted and unknown variables cannot be selected; missing runtime values block sending',async()=>{
  reset();for(const inspection of ['REQ','REJ','ING']){catalog[1].inspectionStatus=inspection;assert.equal((await put('D')).status,409);}
  catalog[1].inspectionStatus='APR';for(const service of ['S','STOP','DELETED']){catalog[1].serviceStatus=service;assert.equal((await put('D')).status,409);}
  catalog[1].serviceStatus='A';catalog[1].templateContent='#{unknown}';assert.equal((await put('D')).status,409);
  assert.equal((await put('A')).status,200);await assert.rejects(()=>getApprovedSsodaaNotificationTemplate('grooming_started',{},null,actorShop));
});
test('private templates of another shop stay invisible, and cross-shop or staff writes are denied',async()=>{
  reset();requests=[{shop_id:'shop-b',template_code:'D'}];platform=platform.filter(row=>row.provider_template_code!=='D');const item=(await (await view()).json()).items.find(r=>r.alias==='grooming_started');assert(!item.options.some(r=>r.code==='D'));assert.equal((await put('D')).status,409);
  assert.equal((await put('A',0,'shop-b')).status,403);role='staff';assert.equal((await put('A')).status,403);assert.equal(selected.length,0);
});
test('stale saves and transaction errors preserve current, with no automatic fallback after provider drift',async()=>{
  reset();assert.equal((await put('A')).status,200);fail=true;assert.equal((await put('D',1)).status,409);fail=false;assert.equal((await put('D',0)).status,409);assert.equal(selected[0].template_code,'A');
  catalog[0].templateContent='changed without explicit save';await assert.rejects(()=>getApprovedSsodaaNotificationTemplate('grooming_started',values,null,actorShop));
  const item=(await (await view()).json()).items.find(r=>r.alias==='grooming_started');assert.equal(item.current.code,'A');assert.equal(item.blocked,true);
});
