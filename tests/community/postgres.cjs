const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
const work = path.join(root, '.codex-work/community-20261109');
const cluster = path.join(work, 'postgres');
const bin = 'C:/Program Files/PostgreSQL/18/bin';
const port = '55461';
function run(name, args, input) {
  const fd = name === 'pg_ctl' ? fs.openSync(path.join(work, 'postgres.log'),'a') : null;
  const r = spawnSync(path.join(bin, name + '.exe'), args, { encoding:'utf8', windowsHide:true, input, maxBuffer:4e6, ...(fd !== null ? {stdio:['ignore',fd,fd]} : {}) });
  if(fd !== null) fs.closeSync(fd);
  fs.appendFileSync(path.join(work, 'postgres.log'), (r.stdout || '') + (r.stderr || ''));
  if (r.status !== 0) throw new Error(name + ': ' + r.stderr + '\n' + r.stdout);
  return r.stdout;
}
const db = 'community_' + Date.now();
const args = ['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db];
let started = false;
try {
  if (!fs.existsSync(cluster)) run('initdb',['-D',cluster,'--auth=trust','--username=postgres','--no-locale','--encoding=UTF8']);
  else if(!process.argv.includes('--reuse')) throw new Error('Retained cluster exists; explicitly pass --reuse after checking ownership.');
  const status=spawnSync(path.join(bin,'pg_ctl.exe'),['-D',cluster,'status'],{encoding:'utf8',windowsHide:true});
  if(status.status!==0) run('pg_ctl',['-D',cluster,'-l',path.join(work,'postgres-server.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start']); started=true;
  run('createdb',['-h','127.0.0.1','-p',port,'-U','postgres',db]);
  for (const file of ['tests/community/fixture.sql','supabase/migrations/20261110114910_member_community.sql','tests/community/assertions.sql']) run('psql',[...args,'-f',path.join(root,file)]);
  fs.writeFileSync(path.join(work,'postgres-result.json'),JSON.stringify({passed:true,environment:'task-owned local PostgreSQL',port,remoteWrites:false}));
  console.log('COMMUNITY_SQL_PASS: membership, cross-shop shared posts, CRUD, conflicts, comment retries, search, blocking, moderation, RLS, Storage restrictions');
} finally {
  if (started) run('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);
}
