import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
registerHooks({resolve(s,c,next){
 if(s==='next/server')return stub('export class NextRequest extends Request{};export const NextResponse={json:(body,init)=>Response.json(body,init)};');
 if(s==='@/server/booking-deposit-ledger')return stub('export const runDepositMaintenance=async shop=>{globalThis.__cronCalls.push(shop);if(globalThis.__cronFail)throw Error("TEST");return{expired:1,confirmed:2,reminders:3,deliveryShops:1};};');
 return next(s,c);
}});
const {GET}=await import('../../src/app/api/cron/booking-deposit-expiry/route.ts');
const req=secret=>({headers:new Headers(secret?{authorization:'Bearer '+secret}:{}),nextUrl:new URL('https://fixture.invalid/api/cron/booking-deposit-expiry?shopId=fixture-only')});
test('missing or wrong cron credentials never invoke maintenance',async()=>{
 globalThis.__cronCalls=[];delete process.env.CRON_SECRET;assert.equal((await GET(req())).status,401);process.env.CRON_SECRET='test-only';assert.equal((await GET(req('wrong'))).status,401);assert.equal(globalThis.__cronCalls.length,0);
});
test('authorized invocation is scoped, uncached and has unique run evidence',async()=>{
 globalThis.__cronCalls=[];globalThis.__cronFail=false;process.env.CRON_SECRET='test-only';
 const a=await GET(req('test-only')),b=await GET(req('test-only')),x=await a.json(),y=await b.json();assert.equal(a.headers.get('cache-control'),'no-store');assert.equal(x.ok,true);assert.equal(x.confirmed,2);assert.notEqual(x.runId,y.runId);assert.deepEqual(globalThis.__cronCalls,['fixture-only','fixture-only']);
});
test('failed invocation returns unavailable rather than success',async()=>{
 globalThis.__cronCalls=[];globalThis.__cronFail=true;process.env.CRON_SECRET='test-only';assert.equal((await GET(req('test-only'))).status,503);delete process.env.CRON_SECRET;
});
