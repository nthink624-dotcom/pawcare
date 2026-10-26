const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const file=path.resolve(__dirname,'../../src/components/booking/booking-preparation-panel.tsx');
let model,calls,confirmed,prompts,phases;
const document={id:'00000000-0000-4000-8000-000000000004',version:1,title:'미용 동의서',body:'기존 고객 동의 내용',scope:'pet',required:true,enabled:true,status:'pending'};
const api=async(url,init)=>{
 const body=JSON.parse(init.body);calls.push({url,body});
 if(url.includes('customer-consents')){model={...model,consentStatus:{...model.consentStatus,pendingCount:0,recognizedCount:1,pendingDocuments:[]},data:{...model.data,consents:[{...document,status:'recognized'}]}};return{};}
 model={...model,version:model.version+1,data:{...model.data,requests:[...model.data.requests,{id:'new',at:'2030-01-01',purposes:['consent'],status:'sent',reason:'동의서 요청 알림톡을 보냈습니다.'}]}};
 return model;
};
const mod=new Module(file);mod.paths=Module._nodeModulePaths(path.dirname(file));
const originalRequire=mod.require.bind(mod);
const jsx=(type,props,key)=>({type,props,key});
function BookingDepositCarry(){}
mod.require=id=>{
 if(id==='react')return{useCallback:f=>f,useEffect(){},useRef:value=>({current:value}),useState:value=>[typeof value==='function'?value():value,()=>{}]};
 if(id==='react/jsx-runtime')return{jsx,jsxs:jsx,Fragment:Symbol.for('fragment')};
 if(id==='@/lib/api')return{fetchApiJson:api,fetchApiJsonWithAuth:api};
 if(id==='@petmanager/shared/contracts/booking-preparation')return{DEPOSIT_STATUS_LABELS:{not_requested:'미요청',confirmed:'입금 확인 완료'}};
 if(id==='@petmanager/shared/lib/use-booking-preparation-read')return{useBookingPreparationRead:()=>({result:model,setResult:value=>{model=value;},load:async()=>{phases.push('reload');return model;}})};
 if(id==='@petmanager/shared/lib/booking-deposit-refresh')return{notifyDepositChanged(){phases.push('invalidate');}};
 if(id==='@petmanager/shared/lib/booking-consent-guidance')return originalRequire(path.resolve(__dirname,'../../../shared/lib/booking-consent-guidance.ts'));
 if(id==='@/components/booking/booking-deposit-carry')return{__esModule:true,default:BookingDepositCarry};
 if(id.startsWith('@/components/')||id.startsWith('@petmanager/shared/components/'))return{__esModule:true,default:()=>null,SignaturePreview:()=>null};
 return originalRequire(id);
};
mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022}}).outputText,file);
const Panel=mod.exports.default;
function reset(){
 calls=[];confirmed=false;prompts=[];phases=[];global.window={confirm:message=>{prompts.push(message);return confirmed;}};
 model={shopId:'fixture',appointmentId:'appointment',guardianId:'guardian',petId:'pet',version:1,appointmentStatus:'confirmed',startAt:'2030-01-02',ledger:null,availableDeposits:[],serviceAmount:30000,remainingAmount:30000,
 data:{policy:{depositMode:'off',templates:[document]},policyVersion:1,consents:[document],deposit:{status:'not_requested',required:false,amount:20000,receivedAmount:0,refundedAmount:0,payerName:''},requests:[],history:[]},
 currentPolicyFeatures:{depositMode:'off',consentEnabled:true,consentTemplates:[document]},consentStatus:{enabled:true,pendingCount:1,recognizedCount:0,signedCount:0,policyVersion:1,pendingDocuments:[document]}};
}
function nodes(value,result=[]){if(!value)return result;if(Array.isArray(value)){value.forEach(v=>nodes(v,result));return result;}if(typeof value==='object'){result.push(value);nodes(value.props?.children,result);}return result;}
function text(node){if(node==null||typeof node==='boolean')return'';if(Array.isArray(node))return node.map(text).join('');return typeof node==='object'?text(node.props?.children):String(node);}
const render=()=>Panel({shopId:'fixture',appointmentId:'appointment'});
const button=(tree,title)=>nodes(tree).find(e=>e.type==='button'&&text(e)===title);

test('pending consent exposes two direct actions, not a false send failure or link-copy-only fallback',()=>{
 reset();const tree=render();assert(button(tree,'기존 동의 인정'));assert(button(tree,'미용 동의서 발송하기'));assert(!text(tree).includes('보내지 못했습니다'));assert(!text(tree).includes('작성 링크 복사'));assert(!nodes(tree).some(n=>n.type===BookingDepositCarry));
});
test('other-date disclosure requires usable money and stays hidden for already-paid legacy reservations',()=>{
 reset();model.availableDeposits=[{id:'other',available:0}];assert(!nodes(render()).some(n=>n.type===BookingDepositCarry));
 model.availableDeposits=[{id:'other',available:5000}];assert(nodes(render()).some(n=>n.type===BookingDepositCarry));model.data.deposit.receivedAmount=20000;model.data.deposit.status='confirmed';assert(!nodes(render()).some(n=>n.type===BookingDepositCarry));
});
test('send confirmation cancel causes zero requests; approval calls existing guidance path exactly once',async()=>{
 reset();await button(render(),'미용 동의서 발송하기').props.onClick();assert.equal(calls.length,0);assert.match(prompts[0],/보내시겠어요/);
 confirmed=true;button(render(),'미용 동의서 발송하기').props.onClick();await new Promise(resolve=>setImmediate(resolve));assert.equal(calls.length,1);assert.equal(calls[0].body.action,'request_guidance');assert.equal(calls[0].body.consent,true);assert.equal(calls[0].body.deposit,false);assert.equal(model.consentStatus.pendingCount,1);assert.equal(model.data.consents[0].status,'pending');
});
test('existing-consent confirmation is explicit, scoped to pet-level documents, and never creates a signature',async()=>{
 reset();await button(render(),'기존 동의 인정').props.onClick();assert.equal(calls.length,0);confirmed=true;await button(render(),'기존 동의 인정').props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(calls.length,1);assert(calls[0].url.includes('customer-consents'));assert.deepEqual(calls[0].body.documents,[{id:document.id,version:1}]);assert.equal(calls[0].body.confirmedExistingConsent,true);assert.equal(model.data.consents[0].status,'recognized');assert.equal(model.data.consents[0].signature,undefined);assert.deepEqual(phases,['reload','invalidate'],'load must finish before broadcasting invalidation');
 reset();model.consentStatus.pendingDocuments=[{...document,scope:'appointment'}];assert(!button(render(),'기존 동의 인정'));
});
test('sent, queued and unknown outcomes cannot be resent; blocked non-delivery can be explicitly retried',()=>{
 for(const status of ['sent','sending','queued','failed']){reset();model.data.requests=[{id:'old',status,purposes:['consent'],reason:'timeout'}];assert.equal(button(render(),'미용 동의서 발송하기').props.disabled,true);}
 reset();model.data.requests=[{id:'old',status:'blocked',purposes:['consent'],reason:'미발송'}];assert.equal(button(render(),'미용 동의서 발송하기').props.disabled,false);
});
test('shop or customer block reason stays visible without preventing existing-consent recognition',()=>{
 reset();model.consentStatus.deliveryBlockReason='고객이 동의서 알림톡 수신을 거부했습니다.';const tree=render();assert(text(tree).includes('수신을 거부'));assert.equal(button(tree,'미용 동의서 발송하기').props.disabled,true);assert.equal(button(tree,'기존 동의 인정').props.disabled,false);
});
test('completed consent is compact and has no pending-action buttons',()=>{
 reset();model.consentStatus={enabled:true,pendingCount:0,recognizedCount:1,signedCount:0};const tree=render();assert(text(tree).includes('기존 동의 인정'));assert(!button(tree,'기존 동의 인정'));assert(!button(tree,'미용 동의서 발송하기'));
});
