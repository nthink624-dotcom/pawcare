import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';

const stub=code=>({shortCircuit:true,url:'data:text/javascript,'+encodeURIComponent(code)});
const state={env:{alimtalkProvider:'ssodaa',alimtalkRelayUrl:'https://relay.fixture.invalid/send',alimtalkRelaySecret:'fixture',alimtalkApiUrl:'https://provider.fixture.invalid/send',alimtalkApiKey:'fixture'},ownership:0,admin:0};
globalThis.__localAlimtalkState=state;
registerHooks({resolve(specifier,context,next){
 if(specifier==='@/lib/server-env')return stub('export const serverEnv=globalThis.__localAlimtalkState.env;export const getConfiguredAlimtalkTemplateKey=()=>null;');
 if(specifier==='@/server/alimtalk-template-ownership')return stub('export const assertAlimtalkTemplateAccess=async()=>{globalThis.__localAlimtalkState.ownership++};');
 if(specifier==='@/server/observability')return stub('export const logOperationalEvent=()=>{};');
 if(specifier==='@/lib/supabase/server')return stub('export const getSupabaseAdmin=()=>{globalThis.__localAlimtalkState.admin++;return null};');
 if(specifier==='@/server/owner-api-auth')return stub('export class OwnerApiError extends Error{constructor(message,status){super(message);this.status=status}};export const requireOwnerShop=async()=>({shopId:"fixture",userId:"fixture"});export const assertOwnerOrManager=()=>{};');
 if(specifier==='@/server/booking-preparation')return stub('export const readBookingPolicy=async()=>({policy:{}});');
 if(specifier==='@/server/alimtalk-approved-template')return stub('export const getApprovedSsodaaTemplateButtonDefaults=async()=>({});export const getRelayTemplateCatalog=async()=>null;export const getApprovedSsodaaTemplateDetails=async()=>({});');
 return next(specifier,context);
}});
const {sendAlimtalkMessage}=await import('../../src/server/alimtalk-provider.ts');
const {POST}=await import('../../src/app/api/owner/alimtalk-templates/route.ts');

test('local read-only mode blocks both relay and direct send before transport or ownership lookup',async()=>{
 const previousMode=process.env.ALIMTALK_RELAY_ACCESS_MODE,previousFetch=globalThis.fetch;
 let fetched=0;
 try{
  process.env.ALIMTALK_RELAY_ACCESS_MODE='read-only';
  globalThis.fetch=async()=>{fetched++;throw Error('Unexpected transport')};
  for(const relayUrl of ['https://relay.fixture.invalid/send',undefined]){
   state.env.alimtalkRelayUrl=relayUrl;
   await assert.rejects(sendAlimtalkMessage({to:'fixture',message:'fixture',templateKey:'fixture'}),/로컬 조회 모드/);
  }
  assert.equal(fetched,0);assert.equal(state.ownership,0);
 }finally{if(previousMode===undefined)delete process.env.ALIMTALK_RELAY_ACCESS_MODE;else process.env.ALIMTALK_RELAY_ACCESS_MODE=previousMode;globalThis.fetch=previousFetch;state.env.alimtalkRelayUrl='https://relay.fixture.invalid/send';}
});

test('local review submission is rejected before draft state changes; draft saves remain permitted',async()=>{
 const previousMode=process.env.ALIMTALK_RELAY_ACCESS_MODE;
 const payload={shopId:'fixture',templateAlias:'booking_confirmed',templateName:'fixture',templateContent:'fixture',categoryCode:'fixture',action:'submit'};
 const request=body=>new Request('https://app.fixture.invalid/api/owner/alimtalk-templates',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 try{
  process.env.ALIMTALK_RELAY_ACCESS_MODE='read-only';
  const denied=await POST(request(payload));assert.equal(denied.status,403);assert.equal(state.admin,0);
  const draft=await POST(request({...payload,action:'save'}));assert.equal(draft.status,503);assert.equal(state.admin,1,'draft store check remains reachable; no actual database was provided');
 }finally{if(previousMode===undefined)delete process.env.ALIMTALK_RELAY_ACCESS_MODE;else process.env.ALIMTALK_RELAY_ACCESS_MODE=previousMode;}
});
