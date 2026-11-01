const assert=require('node:assert/strict'),test=require('node:test'),fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const file=path.resolve(__dirname,'../../src/components/owner-web/booking-grooming-history.tsx');
test('a booking without pet_id renders an explicit missing link without fetching or guessing a sibling',()=>{
 const mod=new Module(file);mod.paths=Module._nodeModulePaths(path.dirname(file));const original=mod.require.bind(mod);let fetches=0;
 mod.require=id=>{
  if(id==='react')return{useState:value=>[value,()=>{}],useEffect:fn=>fn(),useRef:value=>({current:value})};
  if(id==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(id==='@/lib/booking-grooming-history')return{readGroomingHistory:()=>{fetches++;throw Error('unexpected read')},readGroomingPhotos:()=>{throw Error('unexpected photos')}};
  if(id==='@/components/owner-web/customer-detail-helpers')return{};
  if(id==='@/components/owner-web/customer-detail-panel')return{};
  return original(id);
 };
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;mod._compile(source,file);
 const result=mod.exports.BookingGroomingHistory({data:{shop:{id:'shop'},pets:[{id:'sibling'}]},petId:null});
 assert(JSON.stringify(result).includes('예약에 연결된 반려동물 정보가 없습니다.'));assert.equal(fetches,0);
});
