import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';
import ts from 'typescript';
const source=readFileSync(new URL('../src/lib/initial-setup-hours-policy.ts',import.meta.url),'utf8');
const api={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports:api});
const hours={1:{enabled:true,open:'09:00',close:'20:00'},2:{enabled:true,open:'11:00',close:'18:00'},0:{enabled:false,open:'00:00',close:'23:59'}};
test('booking envelope follows enabled hours instead of old hidden booking cutoff',()=>{assert.equal(JSON.stringify(api.bookingBoundsFromHours(hours)),JSON.stringify({bookingStart:'09:00',bookingEnd:'20:00'}));});
test('weekly all-closed and invalid biweekly anchors fail',()=>{assert.throws(()=>api.validateClosedPolicy('weekly','',[1,2],hours));for(const date of ['', '2026-02-30','bad']) assert.throws(()=>api.validateClosedPolicy('biweekly',date,[1],hours));assert.doesNotThrow(()=>api.validateClosedPolicy('biweekly','2026-09-21',[1],hours));for(const cycle of ['monthly_1_3','monthly_2_4'])assert.doesNotThrow(()=>api.validateClosedPolicy(cycle,'',[1],hours));});

test('restored calendar intent preserves concurrent additions and does not resurrect concurrent removals',()=>{assert.equal(JSON.stringify(api.restoreTemporaryClosedDates(['A','B'],['A'],['A'])),JSON.stringify(['A','B']));assert.equal(JSON.stringify(api.restoreTemporaryClosedDates(['B'],['A'],['A'])),JSON.stringify(['B']));assert.equal(JSON.stringify(api.restoreTemporaryClosedDates(['A','B'],['C'],['A'])),JSON.stringify(['B','C']));assert.equal(JSON.stringify(api.restoreTemporaryClosedDates(['A','B'],['A'])),JSON.stringify(['A','B']));});

test('one weekday selection drives weekly closure or monthly closure without disabling other weeks',()=>{const ui=Object.fromEntries([0,1,2,3,4,5,6].map(day=>[day,{enabled:day!==1,open:'10:00',close:'19:00'}]));const weekly=api.unifiedHoursPolicy(ui,'weekly');assert.equal(weekly.businessHours[1].enabled,false);assert.equal(JSON.stringify(weekly.regularClosedDays),'[1]');for(const cycle of ['monthly_1_3','monthly_2_4']){const monthly=api.unifiedHoursPolicy(ui,cycle);assert.equal(monthly.businessHours[1].enabled,true);assert.equal(monthly.businessHours[1].open,'10:00');assert.equal(JSON.stringify(monthly.regularClosedDays),'[1]');assert.equal(ui[1].enabled,false);}assert.equal(api.unifiedHoursPolicy(ui,'weekly').businessHours[1].enabled,false);});
