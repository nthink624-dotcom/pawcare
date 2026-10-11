const fs=require('fs'),path=require('path'),os=require('os'),{spawnSync,spawn}=require('child_process');
const root=path.resolve(__dirname,'../..'),bin='C:/Program Files/PostgreSQL/18/bin',port='55463';
const cluster=fs.mkdtempSync(path.join(os.tmpdir(),'petmanager-deposit-hold-'));
if(fs.realpathSync(cluster).toLowerCase().startsWith('d:\\onedrive'))throw Error('Development artifacts must remain outside OneDrive');
function run(tool,args,input){const r=spawnSync(path.join(bin,tool+'.exe'),args,{input,encoding:'utf8',windowsHide:true,timeout:30000,...(tool==='pg_ctl'?{stdio:'ignore'}:{})});if(r.status!==0)throw Error(r.stderr||r.stdout||r.error?.message||tool);return r.stdout||'';}
const args=['-X','-qAt','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d','postgres'];
const sql=s=>run('psql',args,s);
function concurrent(s){const p=spawn(path.join(bin,'psql.exe'),args,{windowsHide:true});let out='',err='';p.stdout.on('data',d=>out+=d);p.stderr.on('data',d=>err+=d);p.stdin.end(s);return new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));}
let started=false;
(async()=>{try {
run('initdb',['-D',cluster,'--auth=trust','--username=postgres','--no-locale','--encoding=UTF8']);
run('pg_ctl',['-D',cluster,'-l',path.join(cluster,'postgres.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start']);started=true;
for(const file of ['tests/sql/booking-deposit-hold-fixture.sql','supabase/migrations/20261006011111_booking_preparation_policies.sql','supabase/migrations/20261007080000_booking_preparation_korean_audit_text.sql','supabase/migrations/20261011151259_booking_deposit_twenty_minute_hold.sql'])sql(fs.readFileSync(path.join(root,file),'utf8'));
sql('create trigger appointments_prevent_staff_overlap before insert or update of shop_id,staff_id,status,start_at,end_at on public.appointments for each row execute function public.prevent_overlapping_staff_appointments();');
console.log(sql(fs.readFileSync(path.join(root,'tests/sql/booking-deposit-hold-assertions.sql'),'utf8')).trim());
// Two clients concurrently acquire the same available staff window; exactly one may succeed.
const race=await Promise.all([concurrent("begin; select public.fixture_booking('concurrent-new'); select pg_sleep(0.4); commit;"),concurrent("begin; select public.fixture_booking('concurrent-new'); select pg_sleep(0.4); commit;")]);
if(race.filter(r=>r.code===0).length!==1||!race.some(r=>r.err.includes('overlaps')))throw Error('concurrent overlap guard failed');
// A report already holds the appointment lock. Expiry must skip it, never cancel it after commit.
const id=sql("select public.fixture_booking('concurrent-report');").trim();
sql(`update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()+interval '0.8 seconds')) where appointment_id='${id}';`);
const reporting=concurrent(`begin; select public.save_booking_preparation('hold-fixture','${id}',1,jsonb_set(data,'{deposit,status}','"reported"')) from public.booking_preparations where appointment_id='${id}'; select pg_sleep(1.4); commit;`);
await new Promise(r=>setTimeout(r,900));
const expiring=concurrent(`select public.expire_unreported_booking_deposits('hold-fixture','${id}',null);`);
const both=await Promise.all([reporting,expiring]);if(both.some(r=>r.code!==0))throw Error('report expiry race failed');
if(sql(`select data#>>'{deposit,status}' from public.booking_preparations where appointment_id='${id}';`).trim()!=='reported')throw Error('report not preserved');
if(sql(`select public.expire_unreported_booking_deposits('hold-fixture','${id}',null);`).trim()!=='0')throw Error('committed report expired');
// Hold the row until the deadline passes: transaction-start time must not allow a late report.
const late=sql("select public.fixture_booking('deadline-wait');").trim();
sql(`update public.booking_preparations set data=jsonb_set(data,'{deposit,dueAt}',to_jsonb(clock_timestamp()+interval '0.6 seconds')) where appointment_id='${late}';`);
const waiting=await concurrent(`begin; select 1 from public.appointments where id='${late}' for update; select pg_sleep(0.9); select public.save_booking_preparation('hold-fixture','${late}',1,jsonb_set(data,'{deposit,status}','"reported"')) from public.booking_preparations where appointment_id='${late}'; commit;`);
if(waiting.code===0||!waiting.err.includes('BOOKING_DEPOSIT_EXPIRED'))throw Error('deadline wait race accepted');
console.log('DEPOSIT_HOLD_CONCURRENT_WRITES_PASS');
}finally{if(started)run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);console.log('POSTGRES_STOPPED fixture='+cluster);}})().catch(e=>{console.error(e.message);process.exitCode=1;});
