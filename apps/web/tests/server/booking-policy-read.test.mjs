import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
import {readFileSync} from 'node:fs';
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
let calls=[],token='owner-session';
globalThis.__policyRead={fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject})),token:()=>token};
registerHooks({resolve(s,c,next){
 if(s==='@/lib/api')return stub('export const fetchApiJsonWithAuth=(url,options)=>globalThis.__policyRead.fetch(url,options);');
 if(s==='@/lib/auth/owner-auth-handoff')return stub('export const readOwnerAuthTokenCache=()=>globalThis.__policyRead.token();');
 return next(s,c);
}});
const {loadOwnerBookingPolicy}=await import('../../src/lib/owner-booking-policy-read.ts');
test('simultaneous same-shop reads share one authenticated no-store request',async()=>{
 calls=[];const a=loadOwnerBookingPolicy('shop-a'),b=loadOwnerBookingPolicy('shop-a');assert.equal(a,b);assert.equal(calls.length,1);assert.equal(calls[0].options.cache,'no-store');assert(calls[0].options.signal instanceof AbortSignal);
 const value={policy:{depositMode:'off'},version:7};calls[0].resolve(value);assert.deepEqual(await a,value);assert.deepEqual(await b,value);
});
test('success is not cached: reopening reads the server again',async()=>{
 calls=[];const a=loadOwnerBookingPolicy('shop-reopen');calls[0].resolve({policy:{depositMode:'off'},version:1});await a;
 const b=loadOwnerBookingPolicy('shop-reopen');assert.equal(calls.length,2);calls[1].resolve({policy:{depositMode:'required'},version:2});assert.equal((await b).version,2);
});
test('failed requests release the slot so retry is possible',async()=>{
 calls=[];const a=loadOwnerBookingPolicy('shop-retry');calls[0].reject(Error('network'));await assert.rejects(a,/network/);
 const b=loadOwnerBookingPolicy('shop-retry');assert.equal(calls.length,2);calls[1].resolve({policy:{},version:3});assert.equal((await b).version,3);
});
test('shops and changed login sessions never share requests; old responses cannot remove a newer flight',async()=>{
 calls=[];token='session-a';const a=loadOwnerBookingPolicy('shop-isolated'),other=loadOwnerBookingPolicy('another-shop');token='session-b';const b=loadOwnerBookingPolicy('shop-isolated');assert.equal(calls.length,3);assert.notEqual(a,b);
 calls[0].resolve({policy:{},version:1});await a;assert.equal(loadOwnerBookingPolicy('shop-isolated'),b);assert.equal(calls.length,3);
 calls[1].resolve({policy:{},version:8});calls[2].resolve({policy:{},version:2});await Promise.all([other,b]);token='owner-session';
});
test('booking policy uses the isolated lazy surface, without mounting unrelated settings editors',()=>{
 const preview=readFileSync(new URL('../../src/components/owner-web/owner-web-preview.tsx',import.meta.url),'utf8');
 const screen=readFileSync(new URL('../../src/components/owner-web/booking-policy-screen.tsx',import.meta.url),'utf8');
 assert.match(preview,/case "bookingPolicy":\s*return <BookingPolicyScreen shopId=\{initialData.shop.id\} \/>;/);
 assert.match(preview,/if \(screen === "bookingPolicy"\) void import\("@\/components\/owner-web\/booking-policy-screen"\)/);
 assert.match(screen,/<BookingPolicyPanel shopId=\{shopId\} editable \/>/);
 assert.match(screen,/id="shop-info-panel-policy"/);assert.match(screen,/data-shop-info-scroll-region/);
 assert.doesNotMatch(screen,/import .*settings-management-screen|import .*settings-alerts-panel|import .*media\/|import .*benefits-management/);
});
