import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/components/owner/owner-app.tsx', import.meta.url), 'utf8');
const ast = ts.createSourceFile('owner-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function find(predicate) {
  let result;
  const visit = node => { if (!result && predicate(node)) result = node; if (!result) ts.forEachChild(node, visit); };
  visit(ast);
  assert.ok(result, 'Production handler must exist');
  return result;
}
function evaluate(text, deps) {
  const js = ts.transpileModule(`const handler = ${text};`, {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  return Function(...Object.keys(deps), js+'; return handler;')(...Object.values(deps));
}
function runtime({timing='on-time', saved=true}={}) {
  const calls=[];
  const state={action:null};
  const deps={
    data:{appointments:[{id:'booking-1',appointment_date:'2026-09-25',appointment_time:'10:00'}]},
    setError: value=>calls.push(['error',value]),
    setMobileGroomingStartAction: value=>{state.action=value},
    getMobileGroomingStartTiming:()=>timing,
    currentDateInTimeZone:()=> '2026-09-25',currentMinutesInTimeZone:()=>600,
    openMobilePhotoStatusAction:(...args)=>calls.push(['photo',...args]),
    startMobileAppointmentWithoutPhoto:id=>calls.push(['start',id]),
    updateAppointment:async (...args)=>{calls.push(['update',...args]);return saved?{id:'booking-1'}:null},
    openCareReport:id=>calls.push(['report',id]),isOwnerDemo:false,
  };
  for(const name of ['completeMobileAppointment','requestMobileGroomingCompletion','requestMobileGroomingStart','requestMobileAppointmentStatusChange','updateAppointmentWithMobilePhotoGuard']) {
    const node=find(n=>ts.isFunctionDeclaration(n)&&n.name?.text===name);
    deps[name]=evaluate(node.getText(ast),deps);
  }
  return {deps,calls,state,choice(name){
    const sheet=find(n=>ts.isJsxSelfClosingElement(n)&&n.tagName.getText(ast)==='OwnerMobileGroomingStartSheet');
    const attr=sheet.attributes.properties.find(n=>ts.isJsxAttribute(n)&&n.name.text===name);
    assert.ok(attr?.initializer?.expression);
    return evaluate(attr.initializer.expression.getText(ast),{...deps,mobileGroomingStartAction:state.action})();
  }};
}
test('generic start, including late appointments, opens choices without writing',()=>{
  for(const timing of ['on-time','late']){const r=runtime({timing});r.deps.requestMobileGroomingStart('booking-1');assert.equal(r.state.action.phase,'start');assert.equal(r.state.action.stage,'choices');assert.deepEqual(r.calls,[])}
});
test('early start requires confirmation and cancelling never changes the booking',()=>{
  const r=runtime({timing:'early'});r.deps.requestMobileGroomingStart('booking-1','photo');assert.equal(r.state.action.stage,'early-confirm');r.choice('onClose');assert.equal(r.state.action,null);assert.deepEqual(r.calls,[]);
});
test('photo selection uses the original booking and phase without prematurely writing status',()=>{
  for(const [phase,status] of [['start','in_progress'],['completion','completed']]){const r=runtime();r.state.action={appointmentId:'booking-1',phase,stage:'choices'};r.choice('onPhotoAction');assert.deepEqual(r.calls,[['photo','booking-1',status,false,false]]);assert.equal(r.state.action,null)}
});
test('completion entry and cancel do not complete; direct completion opens care report only after save',async()=>{
  const r=runtime();r.deps.requestMobileAppointmentStatusChange('booking-1','completed');assert.equal(r.state.action.phase,'completion');assert.deepEqual(r.calls,[]);r.choice('onClose');assert.deepEqual(r.calls,[]);
  r.deps.requestMobileGroomingCompletion('booking-1');r.choice('onDirectAction');await new Promise(setImmediate);assert.equal(r.calls[0][0],'update');assert.equal(r.calls[0][2].status,'completed');assert.deepEqual(r.calls[1],['report','booking-1']);
  const failed=runtime({saved:false});await failed.deps.completeMobileAppointment('booking-1','without-photo');assert.equal(failed.calls.filter(c=>c[0]==='report').length,0);
});
test('plain detail status actions open the chooser but media-bound requests keep their original path',async()=>{
  const r=runtime();r.deps.updateAppointmentWithMobilePhotoGuard('booking-1',{status:'completed'});assert.equal(r.state.action.phase,'completion');assert.deepEqual(r.calls,[]);
  r.deps.updateAppointmentWithMobilePhotoGuard('booking-1',{status:'completed',mediaAssetIds:['existing-photo']});assert.equal(r.calls[0][0],'update');
});
