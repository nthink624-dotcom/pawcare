import {alimtalkStorageFixture,uncachedCatalogFixture} from '../helpers/alimtalk-storage-fixture.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';

const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
let rows=[],catalog={},platformRows=[],registered=[],sequence=0,queries=[],simulateSaveFailure=false;
const clone=value=>structuredClone(value);
class Query {
  constructor(table){this.table=table;this.filters=[];this.operation='select';this.payload=null;this.maximum=Infinity;}
  select(){return this;}or(){this.filters.push(r=>r.service_status==='active'||['requested','reviewing','unknown','pending'].includes(r.inspection_status));return this;} range(from,to){this.window=[from,to];return this;} order(){return this;} limit(n){this.maximum=n;return this;}
  eq(k,v){this.filters.push(r=>r[k]===v);return this;} neq(k,v){this.filters.push(r=>r[k]!==v);return this;}
  in(k,v){this.filters.push(r=>v.includes(r[k]));return this;}
  insert(v){this.operation='insert';this.payload=v;return this;}
  update(v){this.operation='update';this.payload=v;return this;}
  async execute(single=false){
    queries.push({table:this.table,operation:this.operation});
    if(this.table==='shop_alimtalk_template_selections')return {data:[],error:null};
    if(this.table==='platform_alimtalk_templates'){const found=platformRows.filter(r=>this.filters.every(f=>f(r)));return {data:clone(single?found[0]??null:found),error:null};}
    assert.equal(this.table,'shop_alimtalk_template_requests');
    if(simulateSaveFailure&&this.operation==='update')return {data:null,error:{code:'MOCK_FAILURE'}};
    let found=rows.filter(r=>this.filters.every(f=>f(r))).slice(0,this.maximum);if(this.window)found=found.slice(this.window[0],this.window[1]+1);
    if(this.operation==='insert'){
      const row={id:'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),inspection_status:'draft',service_status:'unknown',created_at:new Date().toISOString(),...this.payload};rows.unshift(row);found=[row];
    }else if(this.operation==='update'){found.forEach(r=>Object.assign(r,this.payload));}
    return {data:clone(single?found[0]??null:found),error:null};
  }
  single(){return this.execute(true);} maybeSingle(){return this.execute(true);}
  then(resolve,reject){return this.execute().then(resolve,reject);}
}
const admin={from:table=>alimtalkStorageFixture(table,()=>({requests:rows,platform:platformRows}))??new Query(table),rpc:async(name,p)=>{
  assert.equal(name,'activate_shop_alimtalk_template');const target=rows.find(r=>r.id===p.p_request&&r.shop_id===p.p_shop),old=rows.find(r=>r.shop_id===p.p_shop&&r.template_alias===target?.template_alias&&r.is_current);
  if(!target||old?.id!==(p.p_expected_current??undefined))return {data:null,error:{code:'40001'}};
  rows.filter(r=>r.shop_id===p.p_shop&&r.template_alias===target.template_alias).forEach(r=>{r.is_current=r.id===target.id});return {data:target.id,error:null};
}};
globalThis.__ownerTemplateTest={admin,auth:async(request,shopId)=>{
  if(shopId&&shopId!=='fixture-a'){const e=new Error('매장 접근 거부');e.status=403;throw e;}
  return {shopId:'fixture-a',userId:'owner-fixture'};
}};
registerHooks({resolve(s,c,next){
  if(s==='@/server/alimtalk-provider-catalog-cache')return stub(uncachedCatalogFixture);

  if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__ownerTemplateTest.admin;');
  if(s==='@/lib/server-env')return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"mock-only"};export const getConfiguredAlimtalkTemplateKey=()=>null;');
  if(s==='@/server/booking-preparation')return stub('export const readBookingPolicy=async()=>({policy:{}});');
  if(s==='@petmanager/shared/lib/deposit-template-values')return stub('export const buildDepositTemplateValues=()=>({});');
  if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(m,s){super(m);this.status=s}} export const requireOwnerShop=async(...a)=>{try{return await globalThis.__ownerTemplateTest.auth(...a)}catch(e){throw new OwnerApiError(e.message,e.status)}};export const assertOwnerOrManager=()=>{};');
  return next(s,c);
}});
const {GET,POST}=await import('../../src/app/api/owner/alimtalk-templates/route.ts');
const {getApprovedSsodaaNotificationTemplate}=await import('../../src/server/alimtalk-approved-template.ts');
const {matchesShopTemplateSnapshot,shopTemplateInspectionState}=await import('../../src/server/shop-alimtalk-template-contract.ts');
const {DEPOSIT_ALIMTALK_REVIEW_CONTRACTS:deposit}=await import('@petmanager/shared/contracts/deposit-alimtalk-review');
const {APPROVED_ALIMTALK_CONTRACTS:common}=await import('@petmanager/shared/contracts/alimtalk');
const alias='appointment_reminder_10m',link='https://www.petmanager.co.kr/m?t=#{예약관리토큰}';
const values={'매장명':'가상 매장','보호자명':'김민수','반려동물명':'보리','예약일시':'11월1일10:00','서비스명':'목욕','예약관리토큰':'fixture-token','예약 확인 링크':'https://www.petmanager.co.kr/m?t=fixture-token','은행명':'가상 은행','입금계좌':'000000','예금주':'실제 송금 금지','예약금액':'20,000','납부기한':'10월31일10:00','기한안내':'기한 안에 신고해 주세요.'};
function detail(code,body,button='예약 확인',patch={}){return {templateCode:code,templateName:'INTERNAL_PROVIDER_NAME',templateContent:body,inspectionStatus:'APR',serviceStatus:'A',buttons:button?[{type:'WL',name:button,linkMobile:link,linkPc:link}]:[],...patch};}
function row(code,body,patch={}){return {id:'00000000-0000-4000-8000-'+String(++sequence).padStart(12,'0'),shop_id:'fixture-a',template_alias:alias,template_code:code,template_content:body,template_name:'INTERNAL_NAME',category_code:'001',inspection_status:'approved',service_status:'a',template_buttons:[{buttonType:'WL',buttonName:'예약 확인',linkMobile:link,linkPc:link}],...patch};}
function reset(target=alias){rows=[];registered=[];queries=[];simulateSaveFailure=false;const c=deposit[target]??common[target];const d=detail(c.code,c.body,c.button);catalog={items:[{alias:target,configuredCode:c.code,detail:d}],allTemplates:[d]};platformRows=[{id:'fixture-platform',provider:'ssodaa',template_alias:target,provider_template_code:c.code,template_content:c.body,buttons:d.buttons,variable_bindings:{},inspection_status:'approved',service_status:'active'}];
  globalThis.fetch=async(url,init={})=>{const parsed=new URL(url);assert.equal(parsed.hostname,'relay.fixture.invalid','external network is forbidden');
    if(parsed.pathname==='/admin/templates/categories')return Response.json({categories:[{code:'001',name:'예약 안내'}]});
    if(parsed.pathname==='/admin/templates'&&(!init.method||init.method==='GET'))return Response.json(catalog);
    if(parsed.pathname==='/admin/templates/register'&&init.method==='POST'){const p=JSON.parse(init.body);assert.equal(p.requestReview,true);assert.equal(p.templateConfigKey,null);registered.push(p);catalog.allTemplates.push(detail(p.templateCode,p.templateContent,p.templateButtons[0]?.buttonName??null,{inspectionStatus:'REQ',serviceStatus:'A'}));return Response.json({accepted:true});}
    throw Error('Unexpected network path '+parsed.pathname);
  };
}
function request(fields){return new Request('http://127.0.0.1/api/owner/alimtalk-templates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({shopId:'fixture-a',templateAlias:alias,templateName:'owner does not choose this',templateContent:'#{보호자명}님, 조금 뒤에 만나요.',categoryCode:'001',action:'submit',...fields})});}
const render=(target=alias,shop='fixture-a')=>getApprovedSsodaaNotificationTemplate(target,values,target,shop);

test('approval updates review status but never replaces the owner current wording automatically',async()=>{
  reset();const old=row('PM_OLD','#{보호자명}님, 이전 승인 문구입니다.',{is_current:true});rows=[old];catalog.allTemplates.push(detail(old.template_code,old.template_content));
  const response=await POST(request({}));assert.equal(response.status,200);const submitted=(await response.json()).template;
  assert.match(submitted.template_code,/^PM[A-F0-9]{26}$/);assert.notEqual(submitted.template_name,'owner does not choose this');assert.equal(registered.length,1);
  assert.equal((await render()).templateCode,old.template_code,'service A alone is not approval');
  catalog.allTemplates.find(t=>t.templateCode===submitted.template_code).inspectionStatus='APR';
  const page=await GET(new Request('http://127.0.0.1/api/owner/alimtalk-templates?shopId=fixture-a'));assert.equal(page.status,200);
  const payload=await page.json();assert.equal(payload.approvedTemplates[alias].templateCode,old.template_code);
  const selected=await render();assert.equal(selected.templateCode,old.template_code);assert.match(selected.body,/이전 승인 문구/);assert.equal(registered.length,1);
  assert.equal(rows.find(row=>row.id===submitted.id).inspection_status,'approved');assert(!rows.find(row=>row.id===submitted.id).is_current);
});
test('draft, rejected, unknown and pending review never replace the previous approved wording',async()=>{
  for(const state of ['draft','rejected','unknown','requested','reviewing']){
    reset();rows=[row('PM_NEW','새 문구',{inspection_status:state}),row('PM_OLD','이전 승인 문구',{is_current:true})];catalog.allTemplates.push(detail('PM_OLD','이전 승인 문구'),detail('PM_NEW','새 문구','예약 확인',{inspectionStatus:state==='rejected'?'REJ':'REQ'}));
    assert.equal((await render()).templateCode,'PM_OLD');
  }
});
test('future global template or another shop wording cannot silently replace this shop selection',async()=>{
  reset();rows=[row('OTHER_SHOP','다른 매장 문구',{shop_id:'fixture-b'})];catalog.allTemplates.push(detail('OTHER_SHOP','다른 매장 문구'),detail('future_v99','최신이라는 이름만 가진 문구'));
  assert.equal((await render()).templateCode,common[alias].code);
  assert.equal((await POST(request({shopId:'fixture-b'}))).status,403);
});
test('mismatched submitted body or button does not become approved; already selected mismatches fail closed',async()=>{
  for(const patch of [{templateContent:'제출하지 않은 본문'},{buttons:[{type:'WL',name:'다른 버튼',linkMobile:link}]}]){
    reset();rows=[row('PM_NEW','제출한 문구',{inspection_status:'requested'}),row('PM_OLD','이전 승인 문구',{is_current:true})];catalog.allTemplates.push(detail('PM_NEW','제출한 문구','예약 확인',patch),detail('PM_OLD','이전 승인 문구'));
    assert.equal((await render()).templateCode,'PM_OLD');assert.equal(rows[0].inspection_status,'requested');
    rows[0].inspection_status='approved';rows[0].is_current=true;rows[1].is_current=false;await assert.rejects(render(),/승인 원문 또는 버튼/);
  }
});
test('provider stopped/removed selected wording blocks rather than falling back, and approval save failure cannot activate it',async()=>{
  reset();rows=[row('PM_LIVE','승인 문구',{is_current:true})];catalog.allTemplates.push(detail('PM_LIVE','승인 문구','예약 확인',{serviceStatus:'S'}));await assert.rejects(render(),/발송을 중단/);
  catalog.allTemplates=[];await assert.rejects(render(),/발송을 중단/);
  reset();rows=[row('PM_PENDING','승인 문구',{inspection_status:'requested'})];catalog.allTemplates.push(detail('PM_PENDING','승인 문구'));simulateSaveFailure=true;await assert.rejects(render(),/승인 결과를 저장하지 못/);assert.equal(rows[0].inspection_status,'requested');
});
test('repeated submit cannot register a second provider template for the same active review',async()=>{
  reset();const first=await POST(request({}));assert.equal(first.status,200);const id=(await first.json()).template.id;
  assert.equal((await POST(request({id}))).status,409);assert.equal(registered.length,1);
});
test('current deposit v2 stays valid; newly approved shop wording is not automatically selected',async()=>{
  reset('booking_deposit_request');const c=deposit.booking_deposit_request;
  const response=await POST(request({templateAlias:'booking_deposit_request',templateContent:c.body}));assert.equal(response.status,200);
  const saved=(await response.json()).template;catalog.allTemplates.find(t=>t.templateCode===saved.template_code).inspectionStatus='APR';
  const resolved=await render('booking_deposit_request');assert.equal(resolved.templateCode,c.code);assert.notEqual(resolved.templateCode,saved.template_code);assert.match(resolved.body,/입금 은행: 가상 은행\n입금 계좌: 000000/);
  const before=rows.length;assert.equal((await POST(request({templateAlias:'booking_deposit_request',templateContent:common.booking_deposit_request.body,action:'save'}))).status,400);assert.equal(rows.length,before);
});
test('status and snapshot helpers require explicit approval, full text and exact signed-link button contract',()=>{
  assert.equal(shopTemplateInspectionState('APR'),'approved');assert.equal(shopTemplateInspectionState('ACTIVE'),'unknown');assert.equal(shopTemplateInspectionState('COMPLETE'),'unknown');
  const s=row('PM_SAFE','안내');assert(matchesShopTemplateSnapshot(s,detail('PM_SAFE','안내')));assert(!matchesShopTemplateSnapshot(s,detail('PM_SAFE','안내','예약 확인',{buttons:[{type:'WL',name:'예약 확인',linkMobile:'https://evil.invalid/'}]})));
});
