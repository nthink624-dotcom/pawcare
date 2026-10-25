import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
registerHooks({resolve(s,c,next){
 if(s==='server-only')return stub('export {};');
 if(s==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>globalThis.__depositTestAdmin;');
 if(s==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error {constructor(m,status){super(m);this.status=status;}}');
 if(s==='@/lib/server-env')return stub('export const serverEnv={supabaseEnvName:"production"};');
 return next(s,c);
}});
const {runDepositMaintenance}=await import('../../src/server/booking-deposit-ledger.ts');
function fake({tickError=null,pendingError=null}={}){
 const calls=[];globalThis.__depositTestAdmin={
  async rpc(name,args){calls.push({rpc:name,args});return{data:{expired:1},error:tickError};},
  from(table){calls.push({table});const q={select(){return q;},eq(){return q;},order(){return q;},limit(){return Promise.resolve({data:[{booking_deposit_accounts:{shop_id:'fixture-a'}},{booking_deposit_accounts:{shop_id:'fixture-b'}},{booking_deposit_accounts:{shop_id:'fixture-a'}}],error:pendingError});},then(resolve,reject){return Promise.resolve({data:[],error:null}).then(resolve,reject);}};return q;}
 };return calls;
}
test('global maintenance drains each pending shop once after the ledger tick',async()=>{
 const calls=fake(),result=await runDepositMaintenance();assert.equal(result.expired,1);assert.equal(result.deliveryShops,2);
 assert.deepEqual(calls[0],{rpc:'pm_deposit_tick',args:{p_shop:null}});assert.equal(calls.filter(c=>c.table==='booking_deposit_accounts').length,2);
});
test('scoped development invocation cannot tick another shop or scan global pending rows',async()=>{
 const calls=fake(),result=await runDepositMaintenance('fixture-a');assert.equal(result.deliveryShops,1);
 assert.deepEqual(calls[0].args,{p_shop:'fixture-a'});assert.equal(calls.filter(c=>c.table==='booking_deposit_outbox').length,0);
});
test('tick failure stops delivery rather than returning success',async()=>{
 const calls=fake({tickError:{code:'FAIL',message:'FAIL'}});await assert.rejects(runDepositMaintenance());assert.equal(calls.length,1);
});
test('outbox lookup failure is a failed invocation',async()=>{
 fake({pendingError:{code:'FAIL',message:'FAIL'}});await assert.rejects(runDepositMaintenance());
});
