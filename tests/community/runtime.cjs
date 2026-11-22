// Isolated test adapter: real API handlers + real SQL RPCs, local filesystem
// Storage only. This file is not imported by either application.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const {spawnSync}=require('node:child_process');
const {NextRequest}=require('next/server');
const load=require('./load.cjs');
const root=path.resolve(__dirname,'../..'),work=path.join(root,'.codex-work/community-20261109');
const bin='C:/Program Files/PostgreSQL/18/bin',cluster=path.join(work,'postgres');
const port='55461',db='community_browser_'+Date.now();
const quote=x=>"'"+String(x).replaceAll("'","''")+"'";
function tool(name,args){
 const fd=name==='pg_ctl'?fs.openSync(path.join(work,'fixture-pg.log'),'a'):null;
 const r=spawnSync(path.join(bin,name+'.exe'),args,{encoding:'utf8',windowsHide:true,maxBuffer:4e6,...(fd===null?{}:{stdio:['ignore',fd,fd]})});
 if(fd!==null)fs.closeSync(fd);if(r.status!==0)throw Error(name+': '+r.stderr+' '+r.stdout);return r.stdout;
}
const pgargs=['-X','-q','-A','-t','-v','ON_ERROR_STOP=1','-h','127.0.0.1','-p',port,'-U','postgres','-d',db];
function sql(q){const file=path.join(work,'fixture-query.sql');fs.writeFileSync(file,q,'utf8');return tool('psql',[...pgargs,'-f',file]).trim();}
const U={a:'10000000-0000-4000-8000-000000000001',b:'10000000-0000-4000-8000-000000000002',staff:'10000000-0000-4000-8000-000000000003'};
class OwnerApiError extends Error{constructor(message,status){super(message);this.status=status;}}
class AdminApiError extends Error{constructor(message,status){super(message);this.status=status;}}
async function start(){
 tool('pg_ctl',['-D',cluster,'-l',path.join(work,'fixture-pg-server.log'),'-o',`-p ${port} -h 127.0.0.1`,'-w','start']);
 let server;
 try{
  tool('createdb',['-h','127.0.0.1','-p',port,'-U','postgres',db]);
  for(const file of ['tests/community/fixture.sql','supabase/migrations/20261110114910_member_community.sql'])tool('psql',[...pgargs,'-f',path.join(root,file)]);
  const photos=new Map();const errors=[];let origin='';
  const storage={from(bucket){if(bucket!=='community-images')throw Error('unexpected bucket');return{
   async upload(key,buffer){const file=path.join(work,'objects',Buffer.from(key).toString('base64url')+'.webp');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,buffer);photos.set(key,file);return{error:null};},
   async remove(keys){if(runtime.failStorageDeletion)return{error:{message:'fixture Storage outage'}};for(const key of keys){const file=photos.get(key);if(file){fs.unlinkSync(file);photos.delete(key);}}return{error:null};},
   async createSignedUrls(keys){return{error:null,data:keys.map(key=>({path:key,signedUrl:origin+'/photos/'+encodeURIComponent(key)}))};},
  };}};
  const admin={storage,async rpc(name,args){try{
    let q;if(name==='community_dispatch')q=`select public.community_dispatch(${quote(args.p_user)},${quote(args.p_shop)},${quote(args.p_action)},${quote(JSON.stringify(args.p_payload??{}))}::jsonb)`;
    else if(name==='community_moderate')q=`select public.community_moderate(${quote(args.p_admin)},${quote(args.p_action)},${args.p_id?quote(args.p_id):'null'})`;
    else throw Error('unexpected RPC');return{data:JSON.parse(sql(q)),error:null};
   }catch(error){errors.push(error.message);return{data:null,error:{message:error.message}};}},
   from(table){if(!['community_posts','community_media_assets','community_media_deletions'].includes(table))throw Error('unexpected table');let columns='*',filters=[],order='',limit='',deleting=false;
    const query={select(c){columns=c;return query;},eq(k,v){filters.push(k+'='+quote(v));return query;},in(k,vs){filters.push(k+' in ('+vs.map(quote).join(',')+')');return query;},order(k){order=' order by '+k;return query;},limit(n){limit=' limit '+Number(n);return query;},delete(){deleting=true;return query;},
      async maybeSingle(){const r=await query;return{...r,data:r.data?.[0]??null};},
      then(resolve,reject){try{const where=filters.length?' where '+filters.join(' and '):'';const q=deleting?'with x as (delete from public.'+table+where+' returning *) select coalesce(json_agg(x),\'[]\') from x':'select coalesce(json_agg(x),\'[]\') from (select '+columns+' from public.'+table+where+order+limit+') x';return Promise.resolve({data:JSON.parse(sql(q)),error:null}).then(resolve,reject);}catch(error){return Promise.resolve({data:null,error:{message:error.message}}).then(resolve,reject);}}
    };return query;
   }
  };
  const service=load('apps/web/src/server/community/service.ts',{'@/lib/supabase/server':{getSupabaseAdmin:()=>admin},'@/server/owner-api-auth':{OwnerApiError}});
  for(const name of ['mutateCommunity','cleanCommunityMedia']){const original=service[name];service[name]=async(...args)=>{try{return await original(...args);}catch(error){errors.push(error.stack);throw error;}};}
  const owner=load('apps/web/src/app/api/owner/community/route.ts',{
   '@/server/owner-api-auth':{OwnerApiError,requireOwnerShop:async(request,shopId)=>{const actor=request.headers.get('x-qa-actor')??'a';if(!U[actor])throw new OwnerApiError('로그인이 필요합니다.',401);return{userId:U[actor],shopId,role:actor==='staff'?'staff':'owner'};}},
   '@/server/owner-mobile-cors':load('apps/web/src/server/owner-mobile-cors.ts'),
   '@/server/community/schema':load('apps/web/src/server/community/schema.ts'),
   '@/server/community/service':service,
  });
  const moderator=load('apps/web/src/app/api/admin/community/route.ts',{
   '@/server/admin-api-auth':{AdminApiError,requireAdminSession:async request=>{if(request.headers.get('x-qa-admin')!=='yes')throw new AdminApiError('관리자 로그인이 필요합니다.',401);return{id:'fixture-admin'};}},
   '@/server/owner-api-auth':{OwnerApiError},'@/server/community/service':service,
  });
  const runtime={sql,U,photos,service,errors,origin:'',failNext:false,failStorageDeletion:false,async handle(url,init={}){
    const request=new NextRequest(url,init);
    if(runtime.failNext&&request.method==='POST'){runtime.failNext=false;return Response.json({message:'검사용 일시 오류입니다. 작성 내용은 유지됩니다.'},{status:503});}
    const handlers=request.nextUrl.pathname.startsWith('/api/admin/')?moderator:owner;
    return handlers[request.method](request);
   },async call(action,payload,actor='a',files=[]){const headers={'x-qa-actor':actor};let body;if(files.length){body=new FormData();body.set('payload',JSON.stringify({action,...payload}));files.forEach(file=>body.append('photos',file));}else{headers['Content-Type']='application/json';body=JSON.stringify({action,...payload});}const response=await runtime.handle(origin+'/api/owner/community?shopId='+ (actor==='b'?'shop-b':'shop-a'),{method:'POST',headers,body});return{status:response.status,data:await response.json()};},
   async close(){if(server)await new Promise(resolve=>server.close(resolve));tool('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);}
  };
  server=http.createServer(async(req,res)=>{try{const url=new URL(req.url,origin);if(url.pathname.startsWith('/photos/')){const file=photos.get(decodeURIComponent(url.pathname.slice(8)));if(!file){res.writeHead(404);res.end();return;}res.setHeader('Content-Type','image/webp');res.end(fs.readFileSync(file));return;}res.writeHead(404);res.end();}catch{res.writeHead(500);res.end();}});
  await new Promise(resolve=>server.listen(55462,'127.0.0.1',resolve));origin='http://127.0.0.1:55462';runtime.origin=origin;
  fs.writeFileSync(path.join(work,'fixture-resources.json'),JSON.stringify({db,cluster,port,photoServerPort:55462}));
  return runtime;
 }catch(error){if(server)server.close();tool('pg_ctl',['-D',cluster,'-m','fast','-w','stop']);throw error;}
}
module.exports={start};
