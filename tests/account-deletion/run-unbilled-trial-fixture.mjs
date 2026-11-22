import assert from 'node:assert/strict';
import * as cp from 'node:child_process';
import * as fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(here,'../..');
const bin=process.env.PETMANAGER_FIXTURE_PG_BIN||'C:/Program Files/PostgreSQL/18/bin';
const root=path.join(process.env.LOCALAPPDATA,'PetManagerTools/IosReview-20261110');
await fs.mkdir(root,{recursive:true});
const physical=await fs.realpath(root);
for(const syncRoot of ['D:/OneDrive',process.env.OneDrive,process.env.OneDriveConsumer,process.env.OneDriveCommercial].filter(Boolean)) {
  const normalized=path.resolve(syncRoot).toLowerCase();
  assert.ok(!physical.toLowerCase().startsWith(normalized+path.sep),'Fixture must stay outside OneDrive');
}
const artifact=path.join(physical,'local-pg-unbilled-trial-'+Date.now());
const data=path.join(artifact,'data');
await fs.mkdir(artifact);
const port=await new Promise((resolve,reject)=>{const s=net.createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
function run(exe,args,options={}) {
  return cp.execFileSync(path.join(bin,exe+'.exe'),args,{encoding:'utf8',windowsHide:true,timeout:30000,...options});
}
function sql(text,dbname='pm_deletion_fixture') {
  return run('psql',['--no-psqlrc','-h','127.0.0.1','-p',String(port),'-U','fixture_owner','-d',dbname,'-v','ON_ERROR_STOP=1','-At'],{input:text});
}
function sqlFile(file) {
  return run('psql',['--no-psqlrc','-h','127.0.0.1','-p',String(port),'-U','fixture_owner','-d','pm_deletion_fixture','-v','ON_ERROR_STOP=1','-At','-f',file]);
}
let started=false,pid,summary;
try {
  run('initdb',['-D',data,'-U','fixture_owner','-A','trust','--encoding=UTF8','--no-locale']);
  // Windows postgres children otherwise inherit captured stdout handles.
  run('pg_ctl',['-D',data,'-l',path.join(artifact,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -F`,'-w','start'],{stdio:'ignore'});
  started=true;pid=Number((await fs.readFile(path.join(data,'postmaster.pid'),'utf8')).split('\n')[0]);
  await fs.writeFile(path.join(artifact,'ownership.json'),JSON.stringify({pid,port,data,started:true,stopped:false},null,2));
  sql('create database pm_deletion_fixture;','postgres');
  sqlFile(path.join(here,'unbilled-trial-fixture.sql'));
  const old=await fs.readFile(path.join(repo,'supabase/migrations/20260901143000_owner_account_deletion_contract.sql'),'utf8');
  const first=old.indexOf('create or replace function public.claim_owner_account_deletion_v1(');
  const last=old.indexOf('create or replace function public.finalize_owner_account_deletion_v1(',first);
  assert.ok(first>=0&&last>first);
  sql(old.slice(first,last));
  sql(`insert into public.shops values('baseline','00000000-0000-4000-8000-000000000001');
    insert into public.owner_subscriptions(user_id,subscription_status,payment_method_exists,last_payment_status,trial_started_at,trial_ends_at)
      values('00000000-0000-4000-8000-000000000001','trialing',false,'none',now(),now()+interval '44 days');
    do $$ declare outcome text; begin
      begin perform public.claim_owner_account_deletion_v1('00000000-0000-4000-8000-000000000001',repeat('b',64));outcome:='unexpected';
      exception when others then outcome:=sqlerrm;end;
      if outcome<>'OWNER_ACCOUNT_DELETION_BILLING_NOT_FINAL' then raise exception 'Original bug did not reproduce';end if;
    end $$;
    delete from public.owner_subscriptions;delete from public.shops;`);
  const migration=process.argv[2]?path.resolve(process.argv[2]):path.join(repo,'supabase/migrations/20261113140345_owner_account_deletion_unbilled_trial.sql');
  sqlFile(migration);
  const output=sqlFile(path.join(here,'unbilled-trial-behavior.sql'));
  summary=JSON.parse(output.trim().split(/\r?\n/).at(-1));
  assert.equal(summary.failed,0);
  assert.equal(summary.passed,30);
  summary={...summary,legacyBugReproduced:true,engine:'local PostgreSQL 18',productionWrites:0,artifact};
} finally {
  const pidFile=await fs.readFile(path.join(data,'postmaster.pid'),'utf8').catch(()=>null);
  if(pidFile){pid=Number(pidFile.split('\n')[0]);started=true;run('pg_ctl',['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});}
  let alive=false;
  if(pid){try{process.kill(pid,0);alive=true;}catch{}}
  assert.equal(alive,false,'Task-owned PostgreSQL must exit');
  await fs.writeFile(path.join(artifact,'ownership.json'),JSON.stringify({pid,port,data,started,stopped:true},null,2));
}
await fs.writeFile(path.join(artifact,'result.json'),JSON.stringify(summary,null,2));
console.log(JSON.stringify({...summary,fixtureServerStopped:true}));
