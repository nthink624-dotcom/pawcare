const test=require('node:test'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto'),sharp=require('sharp');
const {start}=require('./runtime.cjs');
test('real handlers, SQL, photo processing, shared reads, moderation and deletion work together',async()=>{
 const r=await start();
 try{
  const id=randomUUID(),buffer=await sharp({create:{width:1800,height:1200,channels:3,background:'#eee2dc'}}).jpeg().withMetadata().toBuffer();
  const created=await r.call('create_post',{id,category:'knowledge',title:'사진 공유',body:'직접 첨부한 사진입니다.'},'a',[new File([buffer],'test.jpg',{type:'image/jpeg'})]);assert.equal(created.status,200,JSON.stringify({created,errors:r.errors}));
  assert.equal(r.photos.size,1);const metadata=await sharp(require('node:fs').readFileSync([...r.photos.values()][0])).metadata();assert.equal(metadata.format,'webp');assert.equal(metadata.width,1600);assert.equal(metadata.exif,undefined);
  const shared=await r.handle(r.origin+'/api/owner/community?shopId=shop-b&postId='+id,{headers:{'x-qa-actor':'b'}});assert.equal(shared.status,200);const data=await shared.json();assert.equal(data.post.isMine,false);assert.equal(data.post.images.length,1);assert.equal(data.post.images[0].objectPath,undefined);
  assert.equal((await r.call('delete_post',{id},'b')).status,404);
  assert.equal((await r.call('create_post',{id,category:'knowledge',title:'사진 공유',body:'직접 첨부한 사진입니다.'},'a',[new File([buffer],'test.jpg',{type:'image/jpeg'})])).status,200);assert.equal(r.photos.size,1);
  assert.equal((await r.call('create_post',{id:randomUUID(),category:'knowledge',title:'손상 파일',body:'본문'},'a',[new File(['invalid'],'bad.jpg',{type:'image/jpeg'})])).status,400);
  assert.equal((await r.call('create_post',{id:randomUUID(),category:'knowledge',title:'부분 업로드 실패',body:'본문'},'a',[new File([buffer],'valid.jpg',{type:'image/jpeg'}),new File(['invalid'],'bad.jpg',{type:'image/jpeg'})])).status,400);assert.equal(r.photos.size,1,'failed partial upload removes only unattached objects');
  const commented=await r.call('create_comment',{id:randomUUID(),postId:id,body:'다른 매장 댓글'},'b');assert.equal(commented.status,200);
  assert.equal((await r.call('report',{targetType:'comment',targetId:commented.data.id,reason:'검토 요청'},'a')).status,200);
  assert.equal((await r.handle(r.origin+'/api/admin/community')).status,401);
  const reports=await(await r.handle(r.origin+'/api/admin/community',{headers:{'x-qa-admin':'yes'}})).json();assert.equal(reports.reports.length,1);assert.equal(reports.reports[0].images.length,1);
  assert.equal((await r.call('delete_comment',{id:commented.data.id},'b')).status,200);
  const review=await r.handle(r.origin+'/api/admin/community',{method:'POST',headers:{'x-qa-admin':'yes','Content-Type':'application/json'},body:JSON.stringify({action:'hide',id:reports.reports[0].id})});assert.equal(review.status,404,'deleted comment does not hide parent');
  r.failStorageDeletion=true;
  const deleted=await r.call('delete_post',{id},'a');assert.equal(deleted.status,200,JSON.stringify({deleted,errors:r.errors}));assert.equal(r.sql('select count(*) from community_media_deletions'),'1','Storage outage keeps deletion queue');assert.equal(r.photos.size,1);
  r.failStorageDeletion=false;await r.service.cleanCommunityMedia();assert.equal(r.photos.size,0);assert.equal(r.sql('select count(*) from community_media_deletions'),'0');
 }finally{await r.close();}
});
