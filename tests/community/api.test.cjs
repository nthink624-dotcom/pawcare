const test = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest } = require('next/server');
const load = require('./load.cjs');
const schema = load('apps/web/src/server/community/schema.ts');
class OwnerApiError extends Error { constructor(message,status){super(message);this.status=status;} }
const cors = load('apps/web/src/server/owner-mobile-cors.ts');
function route(authorized=true) {
  const calls=[];
  const mod=load('apps/web/src/app/api/owner/community/route.ts',{
    '@/server/owner-api-auth':{OwnerApiError,requireOwnerShop:async(req,shop)=>{if(!authorized)throw new OwnerApiError('로그인이 필요합니다.',401);return{userId:'verified-user',shopId:shop,role:'staff'};}},
    '@/server/owner-mobile-cors':cors,
    '@/server/community/schema':schema,
    '@/server/community/service':{
      cleanCommunityMedia:async()=>{},communityDispatch:async(...args)=>{calls.push(args);return{posts:[]};},
      resolveCommunityImages:async x=>x,
      mutateCommunity:async(...args)=>{calls.push(args);return{id:'verified-post'};},
    },
  });return{...mod,calls};
}
const id='20000000-0000-4000-8000-000000000001';
const payload={action:'create_post',id,category:'operations',title:'운영 질문',body:'실제 경험을 나눕니다.'};
test('all reads and writes require existing authentication before data access',async()=>{
  const r=route(false);
  assert.equal((await r.GET(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a'))).status,401);
  assert.equal((await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',body:'not json'}))).status,401);
  assert.equal(r.calls.length,0);
});
test('reads are private and query validation prevents unbounded requests',async()=>{
  const r=route();const response=await r.GET(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a&q=%25'));
  assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(r.calls[0][0].userId,'verified-user');
  assert.equal((await r.GET(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a&page=-1'))).status,400);
});
test('client identity, storage paths and moderation flags are discarded',async()=>{
  const r=route();const response=await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,userId:'forged',author_id:'forged',hidden:false,newMedia:[{objectPath:'another-user/private.webp'}]})}));
  assert.equal(response.status,200);assert.equal(r.calls[0][0].userId,'verified-user');assert.equal(r.calls[0][1].newMedia,undefined);assert.equal(r.calls[0][1].author_id,undefined);
});
test('multipart photos retain correct boundaries and server schema',async()=>{
  const r=route();const form=new FormData();form.set('payload',JSON.stringify(payload));form.append('photos',new File(['photo'],'photo.webp',{type:'image/webp'}));
  assert.equal((await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',body:form}))).status,200);
  assert.equal(r.calls[0][2].length,1);assert.equal(r.calls[0][2][0].type,'image/webp');
});
test('oversized and invalid writes fail before mutations',async()=>{
  const r=route();
  for(const body of [{...payload,title:''},{...payload,category:'bad'},{...payload,action:'update_post',expectedUpdatedAt:'bad'},{action:'report',targetType:'post',targetId:id,reason:'x'}]){
    const response=await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}));assert.equal(response.status,400);
  }
  assert.equal((await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':'4000000'},body:'{}'}))).status,413);
  assert.equal(r.calls.length,0);
});
test('mobile preflight permits only known app origins',()=>{
  const r=route();const good=r.OPTIONS(new NextRequest('http://127.0.0.1/api/owner/community',{method:'OPTIONS',headers:{Origin:'capacitor://localhost','Access-Control-Request-Method':'POST'}}));
  assert.equal(good.status,204);assert.equal(good.headers.get('Access-Control-Allow-Origin'),'capacitor://localhost');
  const bad=r.OPTIONS(new NextRequest('http://127.0.0.1/api/owner/community',{method:'OPTIONS',headers:{Origin:'https://evil.example'}}));assert.equal(bad.headers.get('Access-Control-Allow-Origin'),null);
});

test('saved-only query parses true/false explicitly and rejects ambiguous values',async()=>{
  const r=route();
  for(const value of ['true','false']){
    const response=await r.GET(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a&savedOnly='+value));
    assert.equal(response.status,200);assert.equal(r.calls.at(-1)[2].savedOnly,value==='true');
  }
  assert.equal((await r.GET(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a&savedOnly=1'))).status,400);
});

test('like/save desired state uses the verified actor and strips forged private fields',async()=>{
  const r=route();
  for(const action of ['like','save']){
    const response=await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,postId:id,active:false,userId:'victim',savedBy:'victim',likeCount:999})}));
    assert.equal(response.status,200);const call=r.calls.at(-1);
    assert.equal(call[0].userId,'verified-user');assert.deepEqual(call[1],{action,postId:id,active:false});
  }
});

test('reaction requests require a post UUID and boolean desired state',async()=>{
  const r=route();
  for(const payload of [{action:'like',postId:id,active:'false'},{action:'save',postId:id},{action:'save',postId:'bad',active:true}]){
    const response=await r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
    assert.equal(response.status,400);
  }
  assert.equal(r.calls.length,0);
});

test('nested comments and votes strip forged identity and reject malformed parents or votes',async()=>{
 const r=route();
 const request=payload=>r.POST(new NextRequest('http://127.0.0.1/api/owner/community?shopId=a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)}));
 assert.equal((await request({action:'create_comment',id,postId:id,parentId:null,body:'답글 내용',authorName:'위조',userId:'victim',isPostAuthor:true})).status,200);
 assert.deepEqual(r.calls.at(-1)[1],{action:'create_comment',id,postId:id,parentId:null,body:'답글 내용'});
 assert.equal((await request({action:'vote_comment',postId:id,commentId:id,value:-1,userId:'victim',score:999})).status,200);
 assert.deepEqual(r.calls.at(-1)[1],{action:'vote_comment',postId:id,commentId:id,value:-1});
 for(const payload of [{action:'create_comment',id,postId:id,parentId:'bad',body:'답글'},{action:'vote_comment',postId:id,commentId:id,value:2},{action:'vote_comment',postId:id,commentId:id,value:'1'}])assert.equal((await request(payload)).status,400);
});
