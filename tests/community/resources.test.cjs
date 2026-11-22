const {test,before,after}=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {start}=require('./runtime.cjs');let fixture;
before(async()=>{fixture=await start();});after(async()=>{if(fixture)await fixture.close();});
async function admin(payload,headers={}){
 const r=await fixture.handle('http://127.0.0.1/api/admin/community/resources',{method:'POST',headers:{'x-qa-admin':'yes','Content-Type':'application/json',...headers},body:JSON.stringify(payload)});
 return {status:r.status,data:await r.json()};
}
async function read(actor='a',page=0,headers={}){
 const r=await fixture.handle('http://127.0.0.1/api/owner/community/resources?shopId='+(actor==='b'?'shop-b':'shop-a')+'&page='+page,{headers:{'x-qa-actor':actor,...headers}});
 return {status:r.status,data:await r.json()};
}
function draft(overrides={}){return {id:randomUUID(),action:'create',title:'검사용 지원사업 소식',body:'실제 지원사업이 아닌 기능 검사용 문구입니다.',sourceUrl:'https://www.sbiz24.kr/',closesOn:null,published:true,...overrides};}

test('published resources are shared across shops, keep safe links and hide operator identity',async()=>{
 const d=draft();assert.equal((await admin({...d,createdBy:'victim',adminId:'victim'})).status,200);
 const a=await read(),b=await read('b');assert.equal(a.status,200);assert.equal(b.status,200);
 assert.deepEqual(a.data.resources,b.data.resources);assert.ok(a.data.resources.some(r=>r.id===d.id));
 assert.equal(a.data.canPublish,false);assert.equal((await read('a',0,{'x-qa-admin':'yes'})).data.canPublish,true);
 assert.equal(JSON.stringify(a.data).includes('fixture-admin'),false);assert.equal(JSON.stringify(a.data).includes('created_by'),false);
});
test('ordinary owner, missing admin and inactive admin cannot publish',async()=>{
 assert.equal((await admin(draft(),{'x-qa-admin':'no'})).status,401);
 assert.equal((await admin(draft(),{'x-qa-admin':'no','x-qa-actor':'a'})).status,401);
});
test('drafts stay hidden, updates require current revision, and republish works',async()=>{
 const d=draft({published:false});let saved=await admin(d);assert.equal(saved.status,200);
 assert.equal((await read()).data.resources.some(r=>r.id===d.id),false);
 saved=await admin({...d,action:'update',published:true,expectedUpdatedAt:saved.data.resource.updatedAt});assert.equal(saved.status,200);
 assert.equal((await read()).data.resources.some(r=>r.id===d.id),true);
 const stale=await admin({...d,action:'update',body:'충돌 검사',expectedUpdatedAt:'2020-01-01T00:00:00Z'});assert.equal(stale.status,409);
 saved=await admin({...d,action:'update',published:false,expectedUpdatedAt:saved.data.resource.updatedAt});assert.equal(saved.status,200);
 assert.equal((await read()).data.resources.some(r=>r.id===d.id),false);
});
test('stable UUID retries do not duplicate or overwrite a changed resource',async()=>{
 const d=draft();assert.equal((await admin(d)).status,200);assert.equal((await admin(d)).status,200);
 assert.equal((await admin({...d,body:'다른 본문'})).status,409);
 assert.equal(fixture.sql(`select count(*) from community_resources where id='${d.id}'`),'1');
});
test('unsafe links, malformed dates, overlong input and cross-site requests are rejected',async()=>{
 for(const override of [{sourceUrl:'javascript:alert(1)'},{sourceUrl:'https://user:secret@example.com/'},{closesOn:'2026-02-30'},{title:'x'.repeat(101)},{published:'true'}])assert.equal((await admin(draft(override))).status,400);
 assert.equal((await admin(draft(),{Origin:'https://foreign.example'})).status,403);
 assert.equal((await admin(draft(),{'Content-Type':'text/plain'})).status,415);
 assert.equal((await admin(draft(),{'Content-Length':'40001'})).status,413);
});
test('member checks, RLS and RPC privileges fail closed',async()=>{
 assert.equal((await read('inactive')).status,401);
 fixture.sql(`select test_reject($q$select community_resource_list('10000000-0000-4000-8000-000000000004','shop-a',0)$q$,'COMMUNITY_FORBIDDEN');select test_reject($q$select community_resource_admin('disabled-admin','create','{}')$q$,'COMMUNITY_FORBIDDEN');`);
 const result=JSON.parse(fixture.sql(`select json_build_object('rls',(select relrowsecurity from pg_class where oid='community_resources'::regclass),'anon',has_table_privilege('anon','community_resources','select'),'auth',has_table_privilege('authenticated','community_resources','insert'),'readRpc',has_function_privilege('authenticated','community_resource_list(uuid,text,integer)','execute'),'writeRpc',has_function_privilege('anon','community_resource_admin(text,text,jsonb)','execute'))`));
 assert.deepEqual(result,{rls:true,anon:false,auth:false,readRpc:false,writeRpc:false});
});

test('legitimate loopback origins use the browser Host despite NextURL normalization',async()=>{
 for(const host of ['127.0.0.1','localhost']){
  const r=await fixture.handle('http://'+host+':3000/api/admin/community/resources',{method:'POST',headers:{'x-qa-admin':'yes','Content-Type':'application/json',Host:host+':3000',Origin:'http://'+host+':3000','Sec-Fetch-Site':'same-origin'},body:JSON.stringify(draft())});
  assert.equal(r.status,200,await r.text());
 }
});

test('malformed origin, changed protocol and cross-site metadata remain rejected',async()=>{
 for(const headers of [{Origin:'not-an-origin',Host:'127.0.0.1'},{Origin:'https://127.0.0.1',Host:'127.0.0.1'},{Origin:'http://127.0.0.1',Host:'127.0.0.1','Sec-Fetch-Site':'cross-site'}])assert.equal((await admin(draft(),headers)).status,403);
});
test('deadline status uses the Korean date and lists are bounded and paginated',async()=>{
 const past=draft({closesOn:'2020-01-01'});assert.equal((await admin(past)).status,200);
 assert.equal((await read()).data.resources.find(r=>r.id===past.id).closed,true);
 for(let i=0;i<21;i++)assert.equal((await admin(draft({title:'페이지 검사 '+i}))).status,200);
 const first=await read(),second=await read('a',1);assert.equal(first.data.resources.length,20);assert.equal(first.data.hasMore,true);assert.ok(second.data.resources.length>0);
 assert.equal(new Set([...first.data.resources,...second.data.resources].map(r=>r.id)).size,first.data.resources.length+second.data.resources.length);
});
