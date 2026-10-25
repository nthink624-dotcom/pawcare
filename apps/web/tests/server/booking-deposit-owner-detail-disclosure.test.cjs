const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),test=require('node:test'),ts=require('typescript'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'../../../..');
const doc={id:'document',version:3,enabled:true,scope:'pet',audience:'all',status:'pending',required:true,title:'반려동물 미용 동의서',body:'고객이 직접 읽고 서명할 문서입니다.'};
const result={version:1,appointmentStatus:'pending',currentPolicyFeatures:{consentEnabled:true,consentTemplates:[doc]},data:{guardianName:'김민수',policy:{templates:[doc],bankName:'확인용 은행',bankAccount:'0000',bankHolder:'확인용'},deposit:{required:true,status:'pending',amount:20000,receivedAmount:0,refundedAmount:0,payerName:'',dueAt:null},consents:[doc],requests:[]}};
function renderPanel(owner){
  const code=ts.transpileModule(fs.readFileSync(path.join(root,'apps/web/src/components/booking/booking-preparation-panel.tsx'),'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
  const stubs={react:{...React,useEffect:()=>{},useState:initial=>[typeof initial==='function'?initial():initial,()=>{}],useRef:()=>({current:null}),useCallback:fn=>fn},'@petmanager/shared/contracts/booking-preparation':{DEPOSIT_STATUS_LABELS:{pending:'입금 대기'}},'@petmanager/shared/lib/use-booking-preparation-read':{useBookingPreparationRead:()=>({result,setResult:()=>{},load:()=>{throw Error('render must not mutate or fetch')}})},'@petmanager/shared/lib/booking-deposit-refresh':{notifyDepositChanged:()=>{throw Error('render must not notify')}}};
  const m={exports:{}};
  Function('require','module','exports',code)(name=>name in stubs?stubs[name]:name==='react/jsx-runtime'?require(name):name.includes('api')?{}:{__esModule:true,default:()=>null,SignaturePreview:()=>null},m,m.exports);
  return renderToStaticMarkup(React.createElement(m.exports.default,{shopId:'shop',appointmentId:'booking',...(owner?{}:{accessToken:'test-only'})}));
}
test('owner detail does not expose consent documents, one-booking waiver or copied guidance links',()=>{
  const html=renderPanel(true);assert.doesNotMatch(html,/고객이 직접 읽고|반려동물 미용 동의서|이 예약만 예외 처리|예약 안내 링크 복사|예약 확인 링크 복사/);assert.match(html,/예약금/);assert.equal(result.data.consents[0].status,'pending');
});
test('customer keeps the same document and real-signature action; owner hiding does not waive consent',()=>{
  const html=renderPanel(false);assert.match(html,/반려동물 미용 동의서/);assert.match(html,/고객이 직접 읽고 서명할 문서입니다/);assert.match(html,/>동의서 작성<\/button>/);assert.match(html,/확인 대기/);assert.doesNotMatch(html,/이 예약만 예외 처리|예약 안내 링크 복사/);assert.equal(result.data.consents[0].status,'pending');
});
test('the accessible status control opens details directly without a redundant summary row',()=>{
  const source=fs.readFileSync(path.join(root,'apps/shared/components/booking-deposit-owner-controls.tsx'),'utf8');assert.match(source,/<div id=\{detailsId\} data-deposit-details hidden=\{!expanded\}/);assert.match(source,/aria-expanded=\{expanded\} aria-controls=\{detailsId\}/);assert.match(source,/min-h-11/);assert.match(source,/focus-visible:outline/);assert.doesNotMatch(source,/예약금 내역·수정|입금액 수정|다른 금액 환불/);assert.match(source,/if \(expanded && d.historyLoaded === false && !busy\) void details\(\)/);
});
