import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const stub = code => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
let state;
const admin = {
  rpc: async (name, args) => {
    if (name === 'claim_alimtalk_approval_job') {
      if (state.lease) return { data: { acquired: false }, error: null };
      state.lease = args.p_run;
      return { data: { acquired: true, afterShop: state.cursor }, error: null };
    }
    assert.equal(name, 'advance_alimtalk_approval_job');
    assert.equal(args.p_run, state.lease);
    state.cursor = args.p_after;
    if (args.p_release) state.lease = null;
    return { data: true, error: null };
  },
  from: table => {
    assert.equal(table, 'shops');
    let after = '', count = 0;
    const query = {
      select: () => query, order: () => query,
      limit: value => { count = value; return query; },
      gt: (key, value) => { assert.equal(key, 'id'); after = value; return query; },
      then: (resolve, reject) => Promise.resolve({ data: state.shops.filter(row => row.id > after).slice(0, count), error: null }).then(resolve, reject),
    };
    return query;
  },
};
globalThis.__approvalWorker = {
  admin,
  catalog: async () => { state.catalogCalls++; return state.providerDown ? null : { allTemplates: [], providerStatus: { connected: true } }; },
  sync: async shop => {
    state.active++; state.peak = Math.max(state.peak, state.active);
    await Promise.resolve(); state.active--;
    state.advanceTime?.();
    if (state.failShop === shop) throw Error('fixture failure');
    state.visited.push(shop);
  },
};
registerHooks({ resolve(specifier, context, next) {
  if (specifier === '@/lib/supabase/server') return stub('export const getSupabaseAdmin=()=>globalThis.__approvalWorker.admin;');
  if (specifier === '@/server/alimtalk-template-ownership') return stub('export const readActiveAlimtalkCodes=async()=>[];export const readPlatformAlimtalkCodes=async()=>[];');
  if (specifier === '@/server/alimtalk-approved-template') return stub('export const getRelayTemplateCatalog=()=>globalThis.__approvalWorker.catalog();');
  if (specifier === '@/server/alimtalk-approval-notices') return stub('export const syncShopAlimtalkApprovals=(shop)=>globalThis.__approvalWorker.sync(shop);');
  return next(specifier, context);
} });
const { runAlimtalkApprovalSync } = await import('../../src/server/alimtalk-approval-worker.ts');
const { GET } = await import('../../src/app/api/cron/alimtalk-approvals/route.ts');
function reset() {
  state = { shops: Array.from({ length: 1_000 }, (_, index) => ({ id: String(index).padStart(4, '0') })), cursor: null, lease: null, visited: [], active: 0, peak: 0, catalogCalls: 0 };
}
test('1,000 offline shops synchronize with page-scoped catalogs and at most 10 simultaneous shops', async () => {
  reset(); const result = await runAlimtalkApprovalSync();
  assert.equal(result.processed, 1_000); assert.equal(result.complete, true);
  assert.equal(new Set(state.visited).size, 1_000);
  assert.equal(state.catalogCalls, 20); assert.equal(state.peak, 10);
  assert.equal(state.cursor, null); assert.equal(state.lease, null);
});
test('failed shop preserves the previous page cursor and next invocation resumes without skipping it', async () => {
  reset(); state.failShop = '0055';
  await assert.rejects(runAlimtalkApprovalSync());
  assert.equal(state.cursor, '0049'); assert.equal(state.lease, null);
  state.failShop = undefined; state.visited = [];
  const result = await runAlimtalkApprovalSync();
  assert.equal(result.processed, 950); assert(state.visited.includes('0055'));
  assert(!state.visited.includes('0049')); assert.equal(result.complete, true);
});
test('overlapping invocation skips; provider outage never advances a cursor or creates approvals', async () => {
  reset(); state.lease = 'existing';
  assert.equal((await runAlimtalkApprovalSync()).skipped, true); assert.equal(state.catalogCalls, 0);
  state.lease = null; state.cursor = '0049'; state.providerDown = true;
  await assert.rejects(runAlimtalkApprovalSync());
  assert.equal(state.cursor, '0049'); assert.equal(state.lease, null); assert.equal(state.visited.length, 0);
});
test('time budget checkpoints and next scheduled run completes remaining shops', async () => {
  reset(); const originalNow = Date.now; let clock = 0;
  Date.now = () => clock; state.advanceTime = () => { clock++; };
  try {
    const first = await runAlimtalkApprovalSync(30);
    assert.equal(first.complete, false); assert.equal(first.processed, 50);
    assert.equal(state.cursor, '0049'); assert.equal(state.lease, null);
    state.advanceTime = undefined;
    const second = await runAlimtalkApprovalSync();
    assert.equal(second.processed, 950); assert.equal(second.complete, true);
  } finally { Date.now = originalNow; }
});
test('cron rejects missing/wrong authorization and cannot be invoked as a public write', async () => {
  reset(); const previous = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await GET(new Request('https://fixture/api/cron/alimtalk-approvals'))).status, 401);
    process.env.CRON_SECRET = 'fixture-only';
    assert.equal((await GET(new Request('https://fixture/api/cron/alimtalk-approvals', { headers: { authorization: 'Bearer wrong' } }))).status, 401);
    assert.equal(state.catalogCalls, 0);
  } finally { if (previous === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previous; }
});
