import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const src=readFileSync(new URL('../src/lib/initial-setup-hours-draft.ts',import.meta.url),'utf8');
const code=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
function load(){const storage=new Map();let now=100000;const exports={};vm.runInNewContext(code,{exports,Date:class extends Date { static now(){ return now; } },window:{localStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)}}});return {api:exports,storage,advance:n=>now+=n};}
const draft={hours:{1:{enabled:true,open:'',close:'19:00'}},bookingStart:'',bookingEnd:'17:00',regularClosedDays:[0]};
test('partial hours restore, stay shop scoped, and clear after confirmed save',()=>{const {api}=load();api.saveHoursDraft('owner:shop-a',draft);assert.equal(JSON.stringify(api.readHoursDraft('owner:shop-a')),JSON.stringify(draft));assert.equal(api.readHoursDraft('owner:shop-b'),null);api.clearHoursDraft('owner:shop-a');assert.equal(api.readHoursDraft('owner:shop-a'),null);});
test('expired and malformed drafts are never applied',()=>{const {api,storage,advance}=load();api.saveHoursDraft('a',draft);advance(86400001);assert.equal(api.readHoursDraft('a'),null);storage.set('a:hours-draft','{"savedAt":86400001,"hours":null}');assert.equal(api.readHoursDraft('a'),null);storage.set('a:hours-draft','invalid');assert.equal(api.readHoursDraft('a'),null);});
test('draft does not serialize extra account fields',()=>{const {api,storage}=load();api.saveHoursDraft('a',{...draft,token:'never-store',staffMembers:['never-store']});assert.ok(!storage.get('a:hours-draft').includes('never-store'));});

test('recurring cycle and anchor survive temporary saving',()=>{const {api}=load();api.saveHoursDraft('a',{...draft,cycle:'biweekly',anchor:'2026-09-21'});assert.equal(api.readHoursDraft('a').cycle,'biweekly');assert.equal(api.readHoursDraft('a').anchor,'2026-09-21');});

test('calendar dates persist and malformed dates are rejected on read',()=>{const {api}=load();api.saveHoursDraft('a',{...draft,temporaryClosedDates:['2026-10-01','2026-10-02']});assert.equal(JSON.stringify(api.readHoursDraft('a').temporaryClosedDates),JSON.stringify(['2026-10-01','2026-10-02']));api.saveHoursDraft('a',{...draft,temporaryClosedDates:['2026-02-30']});assert.equal(api.readHoursDraft('a'),null);});
