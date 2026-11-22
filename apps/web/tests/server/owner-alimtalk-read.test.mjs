import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const stub=source=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(source)});
let token='fixture-session',calls=[];
globalThis.__alimtalkRead={token:()=>token,fetch:(url,options)=>new Promise((resolve,reject)=>calls.push({url,options,resolve,reject}))};
registerHooks({resolve(s,c,next){
 if(s==='@/lib/api')return stub('export const fetchApiJsonWithAuth=(...args)=>globalThis.__alimtalkRead.fetch(...args);');
 if(s==='@/lib/auth/owner-auth-handoff')return stub('export const readOwnerAuthTokenCache=()=>globalThis.__alimtalkRead.token();');
 return next(s,c);
}});
const {readOwnerAlimtalkResource:read,peekOwnerAlimtalkRead:peek,invalidateOwnerAlimtalkReads:invalidate,prefetchOwnerAlimtalk:prefetch}=await import('../../src/lib/owner-alimtalk-read.ts');

test('prefetch and entry share requests; a warm response is immediately available only in the same shop and session',async()=>{
 calls=[];prefetch('prefetch-shop');assert.equal(calls.length,2);
 const pending=read('prefetch-shop','templates',true);assert.equal(calls.length,2);
 assert.equal(calls[0].options.cache,'no-store');assert(calls[0].options.signal instanceof AbortSignal);
 calls[0].resolve({templates:['fixture']});calls[1].resolve({items:[]});await pending;await Promise.resolve();
 assert.deepEqual(peek('prefetch-shop','templates'),{templates:['fixture']});
 await read('prefetch-shop','templates',true);assert.equal(calls.length,2);
 assert.equal(peek('different-shop','templates'),undefined);
 token='different-session';assert.equal(peek('prefetch-shop','templates'),undefined);token='fixture-session';
});
test('expiry and explicit refresh fetch new authoritative responses',async()=>{
 calls=[];const first=read('expiry-shop','templates');calls[0].resolve({version:1});await first;
 const originalNow=Date.now;Date.now=()=>originalNow()+16_000;
 try{assert.equal(peek('expiry-shop','templates'),undefined);const next=read('expiry-shop','templates',true);assert.equal(calls.length,2);calls[1].resolve({version:2});await next;}finally{Date.now=originalNow;}
 const fresh=read('expiry-shop','templates');assert.equal(calls.length,3);calls[2].resolve({version:3});await fresh;
});
test('mutation invalidation prevents an older in-flight response from repopulating the cache',async()=>{
 calls=[];const old=read('changed-shop','templates');invalidate('changed-shop');
 const next=read('changed-shop','templates');calls[1].resolve({version:2});await next;
 calls[0].resolve({version:1});await old;assert.deepEqual(peek('changed-shop','templates'),{version:2});
});
test('failures retry, session changes isolate pending requests, and anonymous reads are never reused',async()=>{
 calls=[];const failed=read('failure-shop','templates');calls[0].reject(Error('fixture failure'));await assert.rejects(failed);
 const retry=read('failure-shop','templates');calls[1].resolve({ok:true});await retry;
 const before=read('session-shop','templates');token='new-session';const after=read('session-shop','templates');
 assert.notEqual(before,after);calls[3].resolve({session:'new'});await after;calls[2].resolve({session:'old'});await before;
 assert.deepEqual(peek('session-shop','templates'),{session:'new'});
 token=null;const one=read('anon','templates',true),two=read('anon','templates',true);assert.notEqual(one,two);assert.equal(peek('session-shop','templates'),undefined);
 calls[4].resolve({});calls[5].resolve({});await Promise.all([one,two]);token='fixture-session';
});
test('temporary read failures retry once, while authorization failures never retry in this cache',async()=>{
 calls=[];const request=read('temporary-shop','templates');calls[0].reject(new TypeError('fixture connection failed'));
 await Promise.resolve();assert.equal(calls.length,2);calls[1].resolve({ok:true});assert.deepEqual(await request,{ok:true});
 const exhausted=read('exhausted-shop','templates');calls[2].reject(Object.assign(Error('fixture unavailable'),{status:503}));
 await Promise.resolve();assert.equal(calls.length,4);calls[3].reject(Object.assign(Error('fixture unavailable'),{status:503}));await assert.rejects(exhausted);assert.equal(calls.length,4);
 const denied=read('denied-shop','templates');calls[4].reject(Object.assign(Error('fixture denied'),{status:403}));await assert.rejects(denied);assert.equal(calls.length,5);
});
