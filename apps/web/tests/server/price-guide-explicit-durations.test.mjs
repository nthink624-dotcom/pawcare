import assert from "node:assert/strict";
import test from "node:test";
import { explicitDurationUpdates } from "../../src/lib/price-guide-explicit-durations.ts";
import { applyWeightDurationUpdates } from "../../src/lib/price-guide-weight-duration-proposal.ts";

const targets = [{ rowIndex: 0, minKg: 0, maxKg: 2, durationMinutes: null }, { rowIndex: 2, minKg: 2, maxKg: 8, durationMinutes: 80 }, { rowIndex: 4, minKg: 8, maxKg: null, durationMinutes: null }];
test("weight-specific values remain distinct; blank and unselected rows are untouched", () => {
  const rows = Array.from({length: 6}, (_, i) => ({priceMinKrw: 10000 + i, durationMinutes: i === 2 ? 80 : null}));
  const doc = {rows, overallNote: "keep", surcharges: [{id:"keep"}]};
  const updates = explicitDurationUpdates(targets, {0:"30",2:"90",4:"",5:"60"});
  assert.deepEqual(updates, [{rowIndex:0,durationMinutes:30},{rowIndex:2,durationMinutes:90}]);
  const next = applyWeightDurationUpdates(doc, updates);
  assert.deepEqual(next.rows.map(r=>r.durationMinutes),[30,null,90,null,null,null]);
  assert.deepEqual(next.rows.map(r=>r.priceMinKrw),rows.map(r=>r.priceMinKrw));
  assert.equal(next.rows[1],rows[1]);assert.equal(next.surcharges,doc.surcharges);
  assert.deepEqual(JSON.parse(JSON.stringify(next)), next);
});
test("existing values are not overwritten by empty inputs or inferred defaults", () => {
  assert.deepEqual(explicitDurationUpdates(targets,{}),[]);
  assert.deepEqual(explicitDurationUpdates(targets,{0:"",2:"",4:""}),[]);
  assert.deepEqual(explicitDurationUpdates(targets,{2:"80"}),[]);
});
test("invalid entered values reject the entire apply instead of partially updating", () => {
  for(const value of ["14","481","30.5","wrong","Infinity"])
    assert.throws(()=>explicitDurationUpdates(targets,{0:"30",2:value}),/15~480/);
});
