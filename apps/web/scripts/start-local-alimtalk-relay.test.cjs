const assert=require('node:assert/strict');
const test=require('node:test');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {inspectRelay,parseEnv,setEnvValue,validateLocalEnvironment,withStartupLock}=require('./start-local-alimtalk-relay.cjs');
const good={NEXT_PUBLIC_SUPABASE_URL:'https://qefxdtmdtvnzgupmjlom.supabase.co',ALIMTALK_PROVIDER:'ssodaa',ALIMTALK_RELAY_URL:'http://127.0.0.1:14010/alimtalk/send',ALIMTALK_RELAY_ADMIN_URL:'http://127.0.0.1:14010/alimtalk/send',ALIMTALK_API_KEY:'fixture',ALIMTALK_TOKEN_KEY:'fixture',ALIMTALK_SENDER_KEY:'fixture'};

test('local startup rejects production DB, shared endpoints, inconsistent ports and full mode',()=>{
 assert.equal(validateLocalEnvironment(good).port,14010);
 for(const change of [
  {NEXT_PUBLIC_SUPABASE_URL:'https://ysxykikqnneuhypybjry.supabase.co'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://user@qefxdtmdtvnzgupmjlom.supabase.co'},
  {NEXT_PUBLIC_SUPABASE_URL:'https://qefxdtmdtvnzgupmjlom.supabase.co/other'},
  {ALLOW_PROD_SUPABASE_IN_DEV:'true'},
  {ALIMTALK_RELAY_ADMIN_URL:'https://relay.petmanager.co.kr/alimtalk/send'},
  {ALIMTALK_RELAY_URL:'https://relay.petmanager.co.kr/alimtalk/send'},
  {ALIMTALK_RELAY_ADMIN_URL:'http://127.0.0.1:4010/alimtalk/send'},
  {ALIMTALK_RELAY_ACCESS_MODE:'full'},
  {ALIMTALK_TOKEN_KEY:''},
 ]) assert.throws(()=>validateLocalEnvironment({...good,...change}));
});

test('local setup changes only the selected env field and preserves unrelated values',()=>{
 const original='NAME=원본\r\nALIMTALK_RELAY_SECRET=previous\r\nOTHER="unchanged"\r\n';
 const updated=setEnvValue(original,'ALIMTALK_RELAY_SECRET','local-fixture');
 assert.deepEqual(parseEnv(updated),{NAME:'원본',ALIMTALK_RELAY_SECRET:'local-fixture',OTHER:'unchanged'});
 assert.equal(parseEnv(setEnvValue(updated,'ALIMTALK_RELAY_ACCESS_MODE','read-only')).ALIMTALK_RELAY_ACCESS_MODE,'read-only');
});

test('a full-mode listener is refused before any local credential is sent',async()=>{
 let calls=0;
 await assert.rejects(inspectRelay('http://127.0.0.1:14010','fixture',async()=>{
  calls++;return Response.json({ok:true,provider:'ssodaa',configured:true});
 }),/not a configured read-only/);
 assert.equal(calls,1);
});

test('readiness requires both read-only health and the matching local credential',async()=>{
 const fake=async(url,options)=>url.endsWith('/health')?Response.json({ok:true,provider:'ssodaa',configured:true,accessMode:'read-only'}):Response.json(url.endsWith('/categories')?{categories:[{code:'fixture'}]}:{}, {status:options.headers['x-relay-secret']==='fixture'?200:401});
 await assert.rejects(inspectRelay('http://127.0.0.1:14010','wrong',fake),/does not match/);
 assert.equal((await inspectRelay('http://127.0.0.1:14010','fixture',fake)).accessMode,'read-only');
 const absent=async()=>{throw Object.assign(new Error('refused'),{cause:{code:'ECONNREFUSED'}})};
 assert.equal(await inspectRelay('http://127.0.0.1:14010','fixture',absent),null);
});

test('an open listener and valid local key do not hide a failed provider read',async()=>{
 const brokenProvider=async url=>url.endsWith('/health')?Response.json({ok:true,provider:'ssodaa',configured:true,accessMode:'read-only'}):url.endsWith('/categories')?Response.json({},{status:502}):Response.json({});
 await assert.rejects(inspectRelay('http://127.0.0.1:14010','fixture',brokenProvider),/provider category read failed/);
});

test('concurrent starts cannot rotate credentials or start a second runtime',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pm-relay-start-lock-'));
 let release;
 const running=withStartupLock(directory,()=>new Promise(resolve=>{release=resolve}));
 try{
  let secondStarted=false;
  await assert.rejects(withStartupLock(directory,()=>{secondStarted=true}),/Another local relay startup/);
  assert.equal(secondStarted,false);
  release('ready');assert.equal(await running,'ready');
  assert.equal(fs.existsSync(path.join(directory,'alimtalk-read-only-start.lock')),false);
 }finally{if(release)release();await running;fs.rmdirSync(directory);}
});

test('stale owned startup locks are recoverable while unknown files are preserved',async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pm-relay-stale-lock-'));
 const lock=path.join(directory,'alimtalk-read-only-start.lock');
 try{
  fs.writeFileSync(lock,JSON.stringify({kind:'petmanager-local-alimtalk-start',pid:12345}));
  assert.equal(await withStartupLock(directory,()=>42,()=>false),42);
  fs.writeFileSync(lock,'unrelated-file');
  await assert.rejects(withStartupLock(directory,()=>0,()=>false),/Another local relay startup/);
  assert.equal(fs.readFileSync(lock,'utf8'),'unrelated-file');
 }finally{if(fs.existsSync(lock))fs.unlinkSync(lock);fs.rmdirSync(directory);}
});
