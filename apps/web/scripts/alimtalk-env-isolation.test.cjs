const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const test=require('node:test');

test('environment comparison accepts isolated local credentials and rejects a production-shared local credential',()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pm-alimtalk-env-test-'));
 const script=path.join(__dirname,'check-alimtalk-template-env-consistency.cjs');
 const keys=[...new Set([...fs.readFileSync(script,'utf8').matchAll(/"(ALIMTALK_[A-Z_]+)"/g)].map(m=>m[1]))];
 const production=Object.fromEntries(keys.map(key=>[key,'fixture']));
 Object.assign(production,{ALIMTALK_RELAY_URL:'https://relay.example/alimtalk/send',ALIMTALK_RELAY_ADMIN_URL:'https://relay.example/alimtalk/send',ALIMTALK_RELAY_SECRET:'production-fixture-credential'});
 const local={...production,ALIMTALK_RELAY_URL:'http://127.0.0.1:14010/alimtalk/send',ALIMTALK_RELAY_ADMIN_URL:'http://127.0.0.1:14010/alimtalk/send',ALIMTALK_RELAY_SECRET:'local-alimtalk-fixture',ALIMTALK_RELAY_ACCESS_MODE:'read-only'};
 const localPath=path.join(directory,'local.env'),productionPath=path.join(directory,'production.env');
 const write=(file,values)=>fs.writeFileSync(file,Object.entries(values).map(([k,v])=>`${k}=${v}`).join('\n'));
 try{
  write(productionPath,production);write(localPath,local);
  const run=()=>spawnSync(process.execPath,[script,`--local=${localPath}`,`--production=${productionPath}`],{encoding:'utf8'});
  let result=run();assert.equal(result.status,0,result.stdout+result.stderr);assert.match(result.stdout,/isolated-local/);
  write(localPath,{...local,ALIMTALK_RELAY_SECRET:production.ALIMTALK_RELAY_SECRET});
  result=run();assert.equal(result.status,1);assert.match(result.stdout,/unsafe-shared-secret/);
 }finally{fs.unlinkSync(localPath);fs.unlinkSync(productionPath);fs.rmdirSync(directory);}
});
