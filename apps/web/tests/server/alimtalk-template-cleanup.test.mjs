import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const stub = code => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
let jobs, ownership, receipts, calls, responseState, providerThrows;
const admin = {
  rpc: async (name, args) => {
    if (name === 'claim_alimtalk_template_cleanup') return { data: structuredClone(jobs), error: null };
    assert.equal(name, 'finish_alimtalk_template_cleanup'); receipts.push(args);
    return { data: true, error: null };
  },
  from: table => {
    assert.equal(table, 'alimtalk_template_registry');
    const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: ownership, error: null }) };
    return query;
  },
};
globalThis.__cleanupTest = { admin };
registerHooks({ resolve(s, context, next) {
  if (s === '@/lib/supabase/server') return stub('export const getSupabaseAdmin=()=>globalThis.__cleanupTest.admin;');
  if (s === '@/lib/server-env') return stub('export const serverEnv={alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"fixture"};');
  if (s === '@/server/admin-api-auth') return stub('export class AdminApiError extends Error{constructor(){super("fixture");this.status=403}};export const requireAdminSession=async()=>{throw new AdminApiError()};');
  return next(s, context);
} });
const { runRetiredAlimtalkCleanup } = await import('../../src/server/alimtalk-template-cleanup.ts');
const { GET: cron } = await import('../../src/app/api/cron/alimtalk-template-cleanup/route.ts');
const { GET: adminStatus } = await import('../../src/app/api/admin/alimtalk/template-cleanup/route.ts');
function reset() {
  jobs = [{ template_code: 'RETIRED_A', attempts: 1 }]; ownership = { scope: 'shop', retired_at: '2026-10-25T00:00:00Z' };
  receipts = []; calls = 0; responseState = 'stopped'; providerThrows = false;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(new URL(url).pathname, '/admin/templates/retire');
    assert.deepEqual(JSON.parse(init.body), { templateCode: 'RETIRED_A' });
    if (providerThrows) throw Error('uncertain timeout');
    return Response.json({ ok: true, state: responseState });
  };
}
test('retired-only cleanup records a verified stop receipt without a customer send', async () => {
  reset(); const result = await runRetiredAlimtalkCleanup();
  assert.equal(calls, 1); assert.equal(result.stopped, 1); assert.equal(receipts[0].p_state, 'stopped');
});
test('a live shop code or platform code cannot reach provider retirement', async () => {
  for (const row of [{ scope: 'shop', retired_at: null }, { scope: 'platform', retired_at: '2026-10-25' }]) {
    reset(); ownership = row; await assert.rejects(runRetiredAlimtalkCleanup()); assert.equal(calls, 0); assert.equal(receipts.length, 0);
  }
});
test('uncertain provider result is recorded once without an immediate retry', async () => {
  reset(); providerThrows = true; const result = await runRetiredAlimtalkCleanup();
  assert.equal(calls, 1); assert.equal(result.unknown, 1); assert.equal(receipts[0].p_state, 'unknown');
});
test('exhausted uncertainty becomes explicit manual review and unsupported success cannot claim deletion', async () => {
  reset(); providerThrows = true; jobs[0].attempts = 6;
  assert.equal((await runRetiredAlimtalkCleanup()).manual_review, 1); assert.equal(receipts[0].p_state, 'manual_review');
  reset(); responseState = 'deleted'; assert.equal((await runRetiredAlimtalkCleanup()).unknown, 1);
});
test('empty queue makes no provider request; unauthorized cron/admin calls cannot run cleanup or inspect it', async () => {
  reset(); jobs = []; assert.equal((await runRetiredAlimtalkCleanup()).processed, 0); assert.equal(calls, 0);
  assert.equal((await cron(new Request('https://fixture/api/cron/alimtalk-template-cleanup'))).status, 401);
  assert.equal((await adminStatus(new Request('https://fixture/api/admin/alimtalk/template-cleanup'))).status, 403);
  assert.equal(calls, 0);
});
