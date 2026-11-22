const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {start}=require('./runtime.cjs');
const work=path.resolve(__dirname,'../../.codex-work/community-20261109');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const fixture=await start();let ws,targetId,send,evaluate,session;
 try{
  for(const [title,category]of [['예약금 운영 경험을 나눠요','operations'],['장비 관리 노하우','knowledge'],['오늘의 매장 이야기','lounge']]){const r=await fixture.call('create_post',{id:randomUUID(),category,title,body:'다른 매장과 경험을 공유하는 검사용 게시글입니다. 고객 정보는 없습니다.'},'b');assert.equal(r.status,200,JSON.stringify(r));}
  const version=await(await fetch('http://127.0.0.1:5171/json/version')).json();ws=new WebSocket(version.webSocketDebuggerUrl);await new Promise(resolve=>ws.addEventListener('open',resolve,{once:true}));
  let next=0;const pending=new Map();
  send=(method,params={},sessionId=session)=>new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
  ws.addEventListener('message',async event=>{const message=JSON.parse(event.data),p=pending.get(message.id);if(p){clearTimeout(p.timer);pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);return;}
   if(message.method==='Fetch.requestPaused'&&message.sessionId===session){const request=message.params.request;try{const headers={...request.headers};delete headers['Content-Length'];delete headers['content-length'];const response=await fixture.handle(request.url,{method:request.method,headers,...(request.method==='POST'?{body:request.postData??''}:{})});await send('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:response.status,responseHeaders:[...response.headers].map(([name,value])=>({name,value})),body:Buffer.from(await response.arrayBuffer()).toString('base64')});}catch(error){if(!error.message.includes('Invalid InterceptionId'))fs.appendFileSync(path.join(work,'browser-intercept.log'),error.stack+'\n');await send('Fetch.fulfillRequest',{requestId:message.params.requestId,responseCode:503,responseHeaders:[{name:'Content-Type',value:'application/json'}],body:Buffer.from(JSON.stringify({message:'검사 요청 처리 실패'})).toString('base64')}).catch(()=>{});}}
  });
  ({targetId}=await send('Target.createTarget',{url:'about:blank'},null));fs.writeFileSync(path.join(work,'browser-resources.json'),JSON.stringify({ownedTabs:[targetId],dedicatedChrome:90316}));
  session=(await send('Target.attachToTarget',{targetId,flatten:true},null)).sessionId;
  evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true,timeout:10000});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;};
  const until=async expression=>{for(let i=0;i<90;i++){if(await evaluate(expression))return;await delay(400);}throw Error('Browser condition timed out: '+expression);};
  await send('Page.enable');await send('Fetch.enable',{patterns:[{urlPattern:'*/api/owner/community*',requestStage:'Request'}]});await send('Page.bringToFront');
  await send('Page.navigate',{url:'http://127.0.0.1:3000/dev/community-preview'});
  await until('!!document.querySelector("[data-community-board]")');await until('document.body.innerText.includes("예약금 운영 경험")');
  const button=(text)=>`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().replace(/^←\\s*/, '')===${JSON.stringify(text)})`;
  const click=async expression=>{await evaluate(`(()=>{const e=${expression};if(!e)throw Error('Missing control');e.click();})()`);await delay(150);};
  const fill=async(selector,text)=>{await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.focus();e.select();})()`);await send('Input.insertText',{text});};
  const checks=[];const viewports=[];
  for(const [width,height]of [[1440,900],[1024,768],[430,900],[390,844]]){
   let w=width,h=height;for(let i=0;i<3;i++){await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:false});await delay(120);const actual=await evaluate('({w:innerWidth,h:innerHeight})');if(Math.abs(actual.w-width)<2)break;w=Math.round(w*width/actual.w);h=Math.round(h*height/actual.h);}
   const state=await evaluate('({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth,smallControls:[...document.querySelectorAll("[data-community-board] button")].filter(e=>e.offsetHeight<44).length})');assert.equal(state.overflow,false);assert.equal(state.smallControls,0);viewports.push(state);
   const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync(path.join(work,`community-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  await click(button('노하우'));await until('document.querySelectorAll("[data-community-board] h2").length===1');checks.push('category filter');
  await click(button('전체'));await fill('#community-search','존재하지않는검색');await click('document.querySelector("button[aria-label=검색]")');await until('document.body.innerText.includes("조건에 맞는 글이 없습니다")');checks.push('search and empty state');
  await fill('#community-search','');await click('document.querySelector("button[aria-label=검색]")');await until('document.body.innerText.includes("예약금 운영 경험")');
  await click(button('글 쓰기'));await fill('input[maxlength="100"]','PC와 앱 공유 테스트');await fill('textarea[maxlength="10000"]','같은 게시판에서 작성하고 확인하는 내용입니다.');await click('document.querySelector("input[type=checkbox]")');await click(button('등록하기'));await until('document.body.innerText.includes("게시글이 저장되었습니다")&&document.body.innerText.includes("댓글 쓰기")');checks.push('create post and server readback');
  await click(button('수정'));await fill('input[maxlength="100"]','수정된 공유 테스트');await click('document.querySelector("input[type=checkbox]")');await click(button('수정 저장'));await until('document.querySelector("article h2")?.textContent==="수정된 공유 테스트"');checks.push('edit post with version guard');
  await fill('textarea[maxlength="2000"]','댓글 입력 유지 테스트');fixture.failNext=true;await click(button('댓글 등록'));await until('document.body.innerText.includes("검사용 일시 오류")');assert.equal(await evaluate('document.querySelector("textarea[maxlength=\\"2000\\"]").value'),'댓글 입력 유지 테스트');checks.push('failed comment retains draft');
  await click(button('댓글 등록'));await until('document.body.innerText.includes("댓글이 등록되었습니다")');assert.equal(fixture.sql("select count(*) from community_comments where body='댓글 입력 유지 테스트'"),'1');checks.push('comment retry saves exactly once');
  await click(button('목록'));await until('document.body.innerText.includes("예약금 운영 경험")');await click('[...document.querySelectorAll("button")].find(e=>e.querySelector("h2")?.textContent==="예약금 운영 경험을 나눠요")');await until('document.body.innerText.includes("작성자 차단")');
  await click(button('신고'));await until('!!document.querySelector("dialog[open]")');await fill('dialog textarea','운영자가 검토해 주세요.');await click(button('신고 접수'));await until('document.body.innerText.includes("신고가 접수되었습니다")');assert.equal(fixture.sql('select count(*) from community_reports'),'1');checks.push('report persisted for admin');
  await click(button('작성자 차단'));await until('!!document.querySelector("dialog[open]")');await click(button('차단하기'));await until('document.body.innerText.includes("작성자를 차단했습니다")&&!document.querySelector("dialog[open]")');await until('!document.body.innerText.includes("예약금 운영 경험")');checks.push('block hides author posts');
  await click(button('내 닉네임·차단 관리'));await until('document.body.innerText.includes("차단 해제")');await click(button('차단 해제'));await until('document.body.innerText.includes("차단한 이용자가 없습니다")');await click(button('목록'));await until('document.body.innerText.includes("예약금 운영 경험")');checks.push('unblock restores shared posts');
  await click('[...document.querySelectorAll("button")].find(e=>e.querySelector("h2")?.textContent==="수정된 공유 테스트")');await until('document.body.innerText.includes("댓글 쓰기")');await click(button('삭제'));await until('!!document.querySelector("dialog[open]")');await click(button('삭제하기'));await until('document.body.innerText.includes("삭제되었습니다")&&!document.querySelector("dialog[open]")');assert.equal(fixture.sql("select count(*) from community_posts where title='수정된 공유 테스트'"),'0');checks.push('own post deletion confirmed');
  await click(button('글 쓰기'));
  const photoFile=path.join(work,'photo-fixture.jpg');await require('sharp')({create:{width:640,height:480,channels:3,background:'#e7ddd0'}}).jpeg().toFile(photoFile);
  const doc=await send('DOM.getDocument');const input=await send('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'input[type=file]'});await send('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[photoFile]});
  await until('!!document.querySelector("img[alt=\\"새 사진 1\\"]")?.naturalWidth');checks.push('browser-selected photo decodes and re-encodes');
  const formShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(path.join(work,'community-form-390.png'),Buffer.from(formShot.data,'base64'));
  await click(button('취소'));
  fs.writeFileSync(path.join(work,'browser-result.json'),JSON.stringify({status:'PASS',checks,viewports,backend:'real handlers and SQL, isolated fixture auth and Storage; no production writes'},null,2));console.log(JSON.stringify({status:'PASS',checks,viewports}));
 }finally{
  if(ws){if(targetId&&send){await send('Target.closeTarget',{targetId},null).catch(()=>{});const targets=await send('Target.getTargets',{},null).catch(()=>({targetInfos:[]}));fs.writeFileSync(path.join(work,'browser-cleanup.json'),JSON.stringify({remainingOwnedTabs:targets.targetInfos.filter(t=>t.targetId===targetId).map(t=>t.targetId)}));}ws.close();}
  await fixture.close();
 }
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
