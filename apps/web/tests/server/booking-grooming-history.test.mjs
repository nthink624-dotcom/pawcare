import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
import { NextRequest } from 'next/server';
const stub=s=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(s)});
const pet='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
let tables,reads,fetches,fetchImpl,dbError,authOptions;
class Query {
 constructor(table){this.table=table;this.filters=[];reads.push(this);}
 select(){return this;} order(){return this;} limit(){return this;}
 eq(key,value){this.filters.push([key,value]);return this;}
 async result(one=false){const rows=(tables[this.table]??[]).filter(r=>this.filters.every(([k,v])=>r[k]===v));return {data:one?rows[0]??null:rows,count:rows.length,error:dbError?{message:'fixture failure'}:null};}
 maybeSingle(){return this.result(true);}then(a,b){return this.result().then(a,b);}
}
globalThis.__historyTest={admin:{from:table=>new Query(table)},fetch:async(url,init)=>{fetches.push({url,init});return fetchImpl(url,init);},auth:(shop,options)=>{authOptions=options;if(shop&&shop!=='shop')throw Object.assign(Error('wrong shop'),{status:403});return {shopId:'shop',role:'owner'};}};
registerHooks({resolve(s,c,next){
 if(s==='@/lib/api')return stub('export const fetchApiJsonWithAuth=(...args)=>globalThis.__historyTest.fetch(...args);');
 if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__historyTest.admin;');
 if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(m,status){super(m);this.status=status}};export const requireOwnerShop=async(r,shop,unused,options)=>{try{return globalThis.__historyTest.auth(shop,options)}catch(e){throw new OwnerApiError(e.message,e.status)}};');
 return next(s,c);
}});
const {scopeGroomingRecords,readGroomingHistory,readGroomingPhotos}=await import('../../src/lib/booking-grooming-history.ts');
const {GET}=await import('../../src/app/api/owner/grooming-records/route.ts');
const record=(id,petId=pet,shop='shop')=>({id,shop_id:shop,pet_id:petId,guardian_id:'same-guardian',groomed_at:'2026-10-01T01:00:00Z',memo:id});
function reset(){reads=[];fetches=[];dbError=false;tables={pets:[{id:pet,shop_id:'shop'},{id:other,shop_id:'other-shop'}],grooming_records:[record('A'),record('B',other),record('foreign',pet,'other-shop')]};}
const request=(query='shopId=shop&petId='+pet)=>new NextRequest('http://fixture/api/owner/grooming-records?'+query);

test('same guardian never joins another pet or shop; missing pet has no inferred history',()=>{
 reset();assert.deepEqual(scopeGroomingRecords(tables.grooming_records,'shop',pet).map(r=>r.id),['A']);assert.deepEqual(scopeGroomingRecords(tables.grooming_records,'shop',other).map(r=>r.id),['B']);assert.deepEqual(scopeGroomingRecords(tables.grooming_records,'shop',null),[]);
});
test('two pets of the same guardian in one shop each receive only their own full records',async()=>{
 reset();tables.pets.push({id:other,shop_id:'shop'});
 assert.deepEqual((await (await GET(request())).json()).records.map(r=>r.memo),['A']);
 assert.deepEqual((await (await GET(request('shopId=shop&petId='+other))).json()).records.map(r=>r.memo),['B']);
});
test('authenticated record read scopes both shop and pet and defers maintenance; no mutation or dispatch API is present',async()=>{
 reset();const response=await GET(request());assert.equal(response.status,200);assert.deepEqual((await response.json()).records.map(r=>r.id),['A']);assert.deepEqual(authOptions,{deferBillingMaintenance:true});assert(reads.every(q=>q.filters.some(([k,v])=>k==='shop_id'&&v==='shop')));assert.equal(response.headers.get('cache-control'),'no-store');
});
test('another shop, missing pet, non-owned pet, and query failure fail closed',async()=>{
 reset();assert.equal((await GET(request('shopId=other&petId='+pet))).status,403);assert.equal((await GET(request('shopId=shop'))).status,400);assert.equal((await GET(request('shopId=shop&petId='+other))).status,404);dbError=true;assert.equal((await GET(request())).status,503);
});
test('record response containing B or another shop is rejected before it can render',async()=>{
 reset();fetchImpl=()=>({records:tables.grooming_records,total:3});await assert.rejects(readGroomingHistory('shop',pet));
 fetchImpl=()=>({records:[record('A')],total:1});assert.equal((await readGroomingHistory('shop',pet)).records[0].memo,'A');assert.equal(fetches[1].init.cache,'no-store');
});
const asset=(id,patch={})=>({id,shop_id:'shop',pet_id:pet,grooming_record_id:'A',status:'ready',deleted_at:null,content_type:'image/png',media_kind:'grooming_before',...patch});
test('all registered before/after photos are preserved and signed in a batch',async()=>{
 reset();const assets=[asset('1'),asset('2'),asset('3',{media_kind:'grooming_after'})];fetchImpl=url=>url.includes('/assets?')?{items:assets.map(mediaAsset=>({mediaAsset})),page:{hasMore:false}}:{items:assets.map(a=>({mediaAssetId:a.id,signedUrl:'https://fixture/'+a.id}))};
 const result=await readGroomingPhotos('shop',pet,'A');assert.deepEqual(result.map(r=>r.asset.id),['1','2','3']);assert.equal(fetches.length,2);assert.deepEqual(JSON.parse(fetches[1].init.body).mediaAssetIds,['1','2','3']);assert(fetches[0].url.includes('petId='+pet));assert(fetches[0].url.includes('groomingRecordId=A'));
});
test('another pet/shop/record photo is never signed, including same-guardian photos',async()=>{
 for(const patch of [{pet_id:other},{shop_id:'other'},{grooming_record_id:'B'}]){reset();fetchImpl=()=>({items:[{mediaAsset:asset('wrong',patch)}],page:{hasMore:false}});await assert.rejects(readGroomingPhotos('shop',pet,'A'));assert.equal(fetches.length,1);}
});
test('empty photos, partial signed URL failure, and network failures remain distinguishable',async()=>{
 reset();fetchImpl=()=>({items:[],page:{hasMore:false}});assert.deepEqual(await readGroomingPhotos('shop',pet,'A'),[]);assert.equal(fetches.length,1);
 fetchImpl=url=>url.includes('/assets?')?{items:[{mediaAsset:asset('1')}],page:{hasMore:false}}:{items:[]};await assert.rejects(readGroomingPhotos('shop',pet,'A'));
 fetchImpl=()=>{throw Error('fixture offline')};await assert.rejects(readGroomingHistory('shop',pet));await assert.rejects(readGroomingPhotos('shop',pet,'A'));
});
test('photo pagination retains previous pages and rejects a stuck cursor rather than silently dropping photos',async()=>{
 reset();fetchImpl=url=>url.includes('/signed-urls')?{items:[{mediaAssetId:'1',signedUrl:'https://fixture/1'},{mediaAssetId:'2',signedUrl:'https://fixture/2'}]}:url.includes('beforeCreatedAt=')?{items:[{mediaAsset:asset('2')}],page:{hasMore:false}}:{items:[{mediaAsset:asset('1')}],page:{hasMore:true,nextBeforeCreatedAt:'2026-10-01'}};
 assert.deepEqual((await readGroomingPhotos('shop',pet,'A')).map(p=>p.asset.id),['1','2']);
 fetchImpl=()=>({items:[],page:{hasMore:true,nextBeforeCreatedAt:null}});await assert.rejects(readGroomingPhotos('shop',pet,'A'));
});
