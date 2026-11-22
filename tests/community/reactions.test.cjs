const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { spawn } = require('node:child_process');
const { start } = require('./runtime.cjs');
let fixture;
before(async()=>{fixture=await start();});
after(async()=>{if(fixture)await fixture.close();});
async function post(actor='a'){
  const id=randomUUID();const result=await fixture.call('create_post',{id,category:'lounge',title:'반응 검사 '+id.slice(0,8),body:'고객 정보가 없는 테스트 게시물입니다.'},actor);
  assert.equal(result.status,200,JSON.stringify(result));return id;
}
async function read(actor='a',query=''){
  const response=await fixture.handle('http://127.0.0.1/api/owner/community?shopId='+(actor==='b'?'shop-b':'shop-a')+query,{headers:{'x-qa-actor':actor}});
  return {status:response.status,data:await response.json()};
}
async function react(action,postId,active,actor='a'){
  const result=await fixture.call(action,{postId,active},actor);assert.equal(result.status,200,JSON.stringify(result));return result.data.reaction;
}

test('existing CRUD, blocking, moderation, media and RLS assertions still pass',()=>{
  const sql=require('node:fs').readFileSync(require('node:path').resolve('tests/community/assertions.sql'),'utf8');
  fixture.sql('begin;\n'+sql+'\nrollback;');
});

test('like/unlike sets an idempotent account state and shared count',async()=>{
  const id=await post();
  assert.deepEqual(await react('like',id,true),{id,likeCount:1,liked:true,saved:false});
  assert.equal((await react('like',id,true)).likeCount,1);
  const other=await react('like',id,true,'b');assert.equal(other.likeCount,2);
  const a=(await read('a','&postId='+id)).data.post;assert.equal(a.likeCount,2);assert.equal(a.liked,true);
  assert.equal((await react('like',id,false)).likeCount,1);
  assert.equal((await react('like',id,false)).likeCount,1);
  assert.equal((await read('b','&postId='+id)).data.post.liked,true);
});

test('saving is private, durable across reads and does not duplicate',async()=>{
  const id=await post('b');
  await react('save',id,true);await react('save',id,true);
  assert.equal(fixture.sql("select count(*) from community_post_saves where post_id='"+id+"'"),'1');
  const mine=(await read('a','&savedOnly=true')).data.posts;
  assert.equal(mine.some(p=>p.id===id&&p.saved),true);
  const other=(await read('b','&savedOnly=true')).data.posts;
  assert.equal(other.some(p=>p.id===id),false);
  const publicView=(await read('b','&postId='+id)).data.post;
  assert.equal(publicView.saved,false);assert.equal('saveCount' in publicView,false);assert.equal('user_id' in publicView,false);
  assert.equal((await react('save',id,false)).saved,false);
  assert.equal((await read('a','&savedOnly=true')).data.posts.some(p=>p.id===id),false);
});

test('failed response can be retried without changing the desired result',async()=>{
  const id=await post();fixture.failNext=true;
  assert.equal((await fixture.call('save',{postId:id,active:true})).status,503);
  assert.equal((await react('save',id,true)).saved,true);
  assert.equal((await react('save',id,true)).saved,true);
  assert.equal(fixture.sql("select count(*) from community_post_saves where post_id='"+id+"'"),'1');
});

test('hidden and mutually blocked posts cannot be interacted with or listed as saved',async()=>{
  const id=await post('b');await react('save',id,true);
  fixture.sql("update community_posts set hidden=true where id='"+id+"'");
  assert.equal((await fixture.call('like',{postId:id,active:true})).status,404);
  assert.equal((await read('a','&savedOnly=true')).data.posts.some(p=>p.id===id),false);
  fixture.sql("update community_posts set hidden=false where id='"+id+"'");
  const blocked=await fixture.call('block',{targetType:'post',targetId:id});assert.equal(blocked.status,200);
  assert.equal((await fixture.call('save',{postId:id,active:true},'b')).status,200);
  assert.equal((await fixture.call('like',{postId:id,active:true})).status,404);
  assert.equal((await read('a','&savedOnly=true')).data.posts.some(p=>p.id===id),false);
  fixture.sql("delete from community_blocks where user_id='"+fixture.U.a+"'");
});

test('post deletion cascades likes/saves and a stale click is rejected',async()=>{
  const id=await post();await react('like',id,true,'b');await react('save',id,true,'b');
  assert.equal((await fixture.call('delete_post',{id})).status,200);
  assert.equal(fixture.sql("select count(*) from community_post_likes where post_id='"+id+"'"),'0');
  assert.equal(fixture.sql("select count(*) from community_post_saves where post_id='"+id+"'"),'0');
  assert.equal((await fixture.call('save',{postId:id,active:true},'b')).status,404);
});

test('saved list paginates by saved time and post ID without leaking another account',async()=>{
  fixture.sql("insert into community_posts(id,author_id,category,title,body) select gen_random_uuid(),'"+fixture.U.a+"','lounge','페이지 검사 '||i,'검사용 본문' from generate_series(1,21) i; insert into community_post_saves(user_id,post_id,created_at) select '"+fixture.U.b+"',id,'2029-01-01'::timestamptz+row_number() over(order by title)*interval '1 second' from community_posts where title like '페이지 검사 %'");
  const one=(await read('b','&savedOnly=true')).data;const two=(await read('b','&savedOnly=true&page=1')).data;
  assert.equal(one.posts.length,20);assert.equal(one.hasMore,true);assert.ok(two.posts.length>=1);
  assert.equal(one.posts.some(p=>two.posts.some(q=>q.id===p.id)),false);
  assert.equal(one.posts.every(p=>p.saved),true);
  const a=(await read('a','&savedOnly=true')).data.posts;
  assert.equal(a.some(p=>p.title.startsWith('페이지 검사 ')),false);
});

test('browser roles cannot read private saves or invoke either RPC entrypoint',()=>{
  for(const role of ['anon','authenticated']){
    for(const query of ["select * from community_post_saves","select * from community_post_likes","select community_reaction_json(gen_random_uuid(),gen_random_uuid())","select community_dispatch('"+fixture.U.a+"','shop-a','list')","select community_dispatch_core('"+fixture.U.a+"','shop-a','list')"]){
      assert.throws(()=>fixture.sql('set role '+role+'; '+query),/permission denied/);
    }
  }
  assert.equal(fixture.sql("select bool_and(relrowsecurity) from pg_class where relname in ('community_post_likes','community_post_saves')"),'t');
  assert.throws(()=>fixture.sql("select community_dispatch('10000000-0000-4000-8000-000000000004','shop-a','save',jsonb_build_object('postId',gen_random_uuid(),'active',true))"),/COMMUNITY_FORBIDDEN/);
});

test('parallel duplicate likes serialize to one persistent row',async()=>{
  const id=await post('b');const meta=require('node:fs').readFileSync(require('node:path').join(process.env.PETMANAGER_COMMUNITY_TEST_WORK_DIR||'.codex-work/community-20261109','fixture-resources.json'),'utf8');const {db,port}=JSON.parse(meta);
  const query="set role service_role; select community_dispatch('"+fixture.U.a+"','shop-a','like','{\"postId\":\""+id+"\",\"active\":true}');";
  await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{const child=spawn('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db,'-c',query],{windowsHide:true,stdio:['ignore','pipe','pipe']});let error='';child.stderr.on('data',b=>error+=b);child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error(error)));})));
  assert.equal(fixture.sql("select count(*) from community_post_likes where post_id='"+id+"'"),'1');
});

test('account deletion cascades private reactions and preserves another author post',async()=>{
  const id=await post('b');await react('like',id,true,'staff');await react('save',id,true,'staff');
  fixture.sql("delete from auth.users where id='"+fixture.U.staff+"'");
  assert.equal(fixture.sql("select count(*) from community_post_likes where user_id='"+fixture.U.staff+"'"),'0');
  assert.equal(fixture.sql("select count(*) from community_post_saves where user_id='"+fixture.U.staff+"'"),'0');
  assert.equal(fixture.sql("select count(*) from community_posts where id='"+id+"'"),'1');
});
