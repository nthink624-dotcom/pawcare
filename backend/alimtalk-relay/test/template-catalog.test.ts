import assert from "node:assert/strict";
import test from "node:test";
import { collectTemplatePages, mapTemplateDetails, sharedTemplateCatalog } from "../src/template-catalog.js";

test("10,037 templates are read past page 20, including the last template", async () => {
  const source = Array.from({ length: 10_037 }, (_, index) => ({ code: String(index) }));
  let pages = 0;
  const rows = await collectTemplatePages(async (page, count) => {
    pages++;
    return { records: source.slice((page - 1) * count, page * count), totalPage: 101, totalCount: source.length };
  }, row => row.code);
  assert.equal(rows.length, 10_037);
  assert.equal(rows.at(-1)?.code, "10036");
  assert.equal(pages, 101);
});
test("provider ignoring pagination or lying about total count cannot return partial success", async () => {
  const records = Array.from({ length: 100 }, (_, code) => ({ code: String(code) }));
  await assert.rejects(collectTemplatePages(async () => ({ records, totalPage: 100 }), row => row.code));
  await assert.rejects(collectTemplatePages(async () => ({ records, totalPage: 1, totalCount: 10_000 }), row => row.code));
});
test("pagination also works when the provider does not include totals", async () => {
  const records = Array.from({ length: 10_000 }, (_, code) => ({ code: String(code) }));
  const result = await collectTemplatePages(async (page, count) => ({ records: records.slice((page - 1) * count, page * count) }), row => row.code);
  assert.equal(result.length, 10_000);
});
test("1,000 concurrent callers share one refresh; expired failures do not reuse stale approvals", async () => {
  let calls = 0, clock = 0, fail = false;
  const load = sharedTemplateCatalog(async () => { calls++; if (fail) throw Error("provider"); return calls; }, 60, () => clock);
  const results = await Promise.all(Array.from({ length: 1_000 }, () => load()));
  assert(results.every(value => value === 1));
  assert.equal(calls, 1);
  clock = 61; fail = true;
  await assert.rejects(load());
  fail = false;
  assert.equal(await load(), 3);
});
test("10,000 detail requests preserve order and respect the concurrency ceiling", async () => {
  let active = 0, peak = 0;
  const rows = Array.from({ length: 10_000 }, (_, index) => index);
  const result = await mapTemplateDetails(rows, 6, async value => {
    active++; peak = Math.max(peak, active);
    await Promise.resolve(); active--;
    return value;
  });
  assert.deepEqual(result, rows);
  assert.equal(peak, 6);
});
test("failed detail pool stops issuing new work and drains in-flight requests before rejecting", async () => {
  let calls = 0, active = 0;
  await assert.rejects(mapTemplateDetails(Array.from({ length: 10_000 }, (_, index) => index), 6, async index => {
    calls++; active++; await Promise.resolve(); active--;
    if (index === 0) throw Error("fixture");
    return index;
  }));
  assert.equal(active, 0); assert(calls <= 6);
});
