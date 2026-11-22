const {test,before,after}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {spawn}=require('node:child_process');
const {start}=require('./runtime.cjs');
let fixture;
before(async()=>{fixture=await start();});
after(async()=>{if(fixture)await fixture.close();});
async function post(actor='b'){
 const id=randomUUID(),r=await fixture.call('create_post',{id,category:'lounge',title:'댓글 검사',body:'실제 API와 SQL로 확인하는 테스트입니다.'},actor);
 assert.equal(r.status,200,JSON.stringify(r));return id;
}
async function comment(postId,parentId=null,actor='a',body='경험을 나눕니다.',id=randomUUID()){
 const r=await fixture.call('create_comment',{id,postId,parentId,body},actor);assert.equal(r.status,200,JSON.stringify(r));return id;
}
async function read(postId,actor='a',page=0){
 const r=await fixture.handle('http://127.0.0.1/api/owner/community?shopId='+(actor==='b'?'shop-b':'shop-a')+'&postId='+postId+'&page='+page,{headers:{'x-qa-actor':actor}});
 assert.equal(r.status,200);return r.json();
}
async function vote(postId,commentId,value,actor='a'){
 const r=await fixture.call('vote_comment',{postId,commentId,value},actor);assert.equal(r.status,200,JSON.stringify(r));return r.data.commentReaction;
}

test('nested comments persist with verified authors and correct original-poster badges',async()=>{
 const p=await post(),a=await comment(p),b=await comment(p,a,'b'),c=await comment(p,b,'staff');
 const d=await read(p);assert.equal(d.comments.length,3);
 assert.equal(d.comments.find(x=>x.id===a).parentId,null);
 assert.equal(d.comments.find(x=>x.id===b).parentId,a);
 assert.equal(d.comments.find(x=>x.id===c).parentId,b);
 assert.equal(d.comments.find(x=>x.id===a).isPostAuthor,false);
 assert.equal(d.comments.find(x=>x.id===b).isPostAuthor,true);
 assert.equal(d.comments.find(x=>x.id===a).isMine,true);
 assert.equal(JSON.stringify(d).includes(fixture.U.a),false);
});
test('stable retry IDs are idempotent and reject changed post, body or parent',async()=>{
 const p=await post(),parent=await comment(p),id=randomUUID();
 await comment(p,parent,'a','재시도 내용',id);await comment(p,parent,'a','재시도 내용',id);
 assert.equal(fixture.sql(`select count(*) from community_comments where id='${id}'`),'1');
 for(const payload of [{postId:p,parentId:null,body:'재시도 내용'},{postId:p,parentId:parent,body:'변경된 내용'},{postId:await post(),parentId:null,body:'재시도 내용'}]){
  const r=await fixture.call('create_comment',{id,...payload});assert.equal(r.status,409,JSON.stringify(r));
 }
});
test('cross-post parents, hidden parents, malformed values and nonmembers cannot write',async()=>{
 const p=await post(),q=await post(),parent=await comment(p);
 assert.equal((await fixture.call('create_comment',{id:randomUUID(),postId:q,parentId:parent,body:'다른 게시글'})).status,404);
 fixture.sql(`update community_comments set hidden=true where id='${parent}'`);
 assert.equal((await fixture.call('create_comment',{id:randomUUID(),postId:p,parentId:parent,body:'숨긴 댓글'})).status,404);
 for(const value of [2,'1',null])assert.equal((await fixture.call('vote_comment',{postId:p,commentId:parent,value})).status,400);
 const invalid=await fixture.handle('http://127.0.0.1/api/owner/community?shopId=shop-a',{method:'POST',headers:{'x-qa-actor':'inactive','Content-Type':'application/json'},body:JSON.stringify({action:'vote_comment',postId:p,commentId:parent,value:1})});assert.equal(invalid.status,401);
});
test('comment votes use desired state, aggregate across accounts and survive reload',async()=>{
 const p=await post(),c=await comment(p);
 assert.deepEqual(await vote(p,c,1),{id:c,vote:1,score:1});
 assert.deepEqual(await vote(p,c,1),{id:c,vote:1,score:1});
 assert.deepEqual(await vote(p,c,-1,'b'),{id:c,vote:-1,score:0});
 let rows=(await read(p)).comments;assert.equal(rows[0].vote,1);assert.equal(rows[0].score,0);
 rows=(await read(p,'b')).comments;assert.equal(rows[0].vote,-1);
 assert.equal((await vote(p,c,-1)).score,-2);assert.equal((await vote(p,c,0)).score,-1);
 assert.equal(fixture.sql(`select count(*) from community_comment_votes where comment_id='${c}'`),'1');
 fixture.failNext=true;assert.equal((await fixture.call('vote_comment',{postId:p,commentId:c,value:1})).status,503);
 assert.equal((await read(p)).comments[0].vote,0);assert.equal((await vote(p,c,1)).score,0);
 assert.equal((await fixture.call('vote_comment',{postId:await post(),commentId:c,value:1})).status,404);
});
test('deleting a parent preserves other authors replies and removes parent votes',async()=>{
 const p=await post(),a=await comment(p),b=await comment(p,a,'staff');await vote(p,a,1);
 assert.equal((await fixture.call('delete_comment',{id:a})).status,200);
 const d=await read(p);assert.equal(d.comments.length,1);assert.equal(d.comments[0].id,b);assert.equal(d.comments[0].parentId,null);
 assert.equal(fixture.sql(`select count(*) from community_comment_votes where comment_id='${a}'`),'0');
});
test('hidden and blocked ancestors are redacted while visible replies retain context',async()=>{
 const p=await post(),a=await comment(p,null,'a','숨겨야 하는 원문'),b=await comment(p,a,'staff','남겨야 하는 답글');
 fixture.sql(`update community_comments set hidden=true where id='${a}'`);
 let d=await read(p,'b'),ancestor=d.comments.find(x=>x.id===a);assert.equal(ancestor.unavailable,true);assert.equal(ancestor.authorName,'');assert.equal(ancestor.body,'볼 수 없는 댓글입니다.');assert.equal(d.comments.find(x=>x.id===b).parentId,a);
 fixture.sql(`update community_comments set hidden=false where id='${a}'`);
 assert.equal((await fixture.call('block',{targetType:'comment',targetId:a},'b')).status,200);
 d=await read(p,'b');assert.equal(d.comments.find(x=>x.id===a).unavailable,true);
 assert.equal(JSON.stringify(d.comments).includes('숨겨야 하는 원문'),false);
 assert.equal((await fixture.call('vote_comment',{postId:p,commentId:a,value:1},'b')).status,404);
 const block=d.blockedUsers.find(x=>x.id);assert.equal((await fixture.call('unblock',{id:block.id},'b')).status,200);
});
test('pagination carries ancestors across page boundaries and nesting is bounded',async()=>{
 const p=await post(),parent=await comment(p);let deepest=parent;
 for(let i=0;i<7;i++)deepest=await comment(p,deepest,'staff');
 assert.equal((await fixture.call('create_comment',{id:randomUUID(),postId:p,parentId:deepest,body:'깊이 초과'})).status,400);
 for(let i=0;i<13;i++)await comment(p);
 const last=await comment(p,parent,'staff');
 const first=await read(p,'a',0),second=await read(p,'a',1);
 assert.equal(first.hasMore,true);assert.equal(second.hasMore,false);
 assert.equal(second.comments.find(x=>x.id===last).parentId,parent);
 assert.ok(second.comments.some(x=>x.id===parent));assert.equal(second.comments.length,3);
});
test('vote rows and every internal RPC are denied to browser roles',()=>{
 const rights=JSON.parse(fixture.sql(`select json_build_object('rls',(select relrowsecurity from pg_class where oid='community_comment_votes'::regclass),'anon',has_table_privilege('anon','community_comment_votes','select'),'auth',has_table_privilege('authenticated','community_comment_votes','insert'),'rpc',has_function_privilege('authenticated','public.community_dispatch(uuid,text,text,jsonb)','execute'),'base',has_function_privilege('anon','public.community_dispatch_posts(uuid,text,text,jsonb)','execute'),'json',has_function_privilege('anon','public.community_comment_json(community_comments,uuid,uuid)','execute'))`));
 assert.deepEqual(rights,{rls:true,anon:false,auth:false,rpc:false,base:false,json:false});
});

test('parallel duplicate comment votes remain a single account row',async()=>{
 const p=await post(),c=await comment(p);
 const resources=JSON.parse(require('node:fs').readFileSync(require('node:path').join(process.env.PETMANAGER_COMMUNITY_TEST_WORK_DIR,'fixture-resources.json'),'utf8'));
 const sql=`select community_dispatch('${fixture.U.a}','shop-a','vote_comment','${JSON.stringify({postId:p,commentId:c,value:1})}'::jsonb)`;
 await Promise.all(Array.from({length:8},()=>new Promise((resolve,reject)=>{
  const child=spawn('C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-q','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',resources.port,'-U','postgres','-d',resources.db,'-c',sql],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  let error='';child.stderr.on('data',chunk=>{error+=chunk;});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error(error)));
 })));
 assert.equal(fixture.sql(`select count(*) from community_comment_votes where comment_id='${c}'`),'1');
 assert.equal((await read(p)).comments[0].score,1);
});

test('account deletion keeps another author replies while deleting that account votes',async()=>{
 const p=await post(),a=await comment(p),b=await comment(p,a,'staff');await vote(p,b,1);
 fixture.sql(`begin;
 delete from auth.users where id='${fixture.U.a}';
 select test_assert(exists(select 1 from community_comments where id='${b}' and parent_comment_id is null),'other author reply survives account deletion');
 select test_assert(not exists(select 1 from community_comment_votes where user_id='${fixture.U.a}'),'account vote cascade');
 rollback;`);
});
