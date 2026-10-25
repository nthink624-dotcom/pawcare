import assert from 'node:assert/strict';
import test from 'node:test';
import { registerHooks } from 'node:module';
const stub = code => ({ shortCircuit: true, url: 'data:text/javascript,' + encodeURIComponent(code) });
let cache, registry, lookups, failCache, providerCodes;
class Query {
  constructor(table) { this.table = table; this.filters = []; }
  select() { return this; }
  in(key, values) { this.filters.push(row => values.includes(row[key])); return this; }
  upsert(rows) { this.rows = rows; return this; }
  then(resolve, reject) { return this.read().then(resolve, reject); }
  async read() {
    if (this.table === 'alimtalk_template_provider_cache' && failCache) return { data: null, error: { code: 'fixture' } };
    if (this.rows) { for (const row of this.rows) cache.set(row.template_code, structuredClone(row)); return { data: [], error: null }; }
    const rows = this.table === 'alimtalk_template_registry' ? registry : [...cache.values()];
    return { data: structuredClone(rows.filter(row => this.filters.every(filter => filter(row)))), error: null };
  }
}
globalThis.__catalogCache = { admin: { from: table => new Query(table) } };
registerHooks({ resolve(s, context, next) {
  if (s === '@/lib/supabase/server') return stub('export const getSupabaseAdmin=()=>globalThis.__catalogCache.admin;');
  if (s === '@/lib/server-env') return stub('export const serverEnv={alimtalkProvider:"ssodaa",alimtalkRelayUrl:"https://relay.fixture.invalid/send",alimtalkRelaySecret:"fixture"};export const getConfiguredAlimtalkTemplateKey=()=>null;');
  return next(s, context);
} });
const { getRelayTemplateCatalog } = await import('../../src/server/alimtalk-approved-template.ts');
const detail = code => ({ templateCode: code, templateContent: 'fixture', templateName: 'fixture', inspectionStatus: 'APR', serviceStatus: 'A', buttons: [] });
function reset() {
  cache = new Map(); lookups = 0; failCache = false; providerCodes = [];
  registry = [{ template_code: 'ACTIVE_A', scope: 'shop', owner_shop_id: 'a', retired_at: null }];
  globalThis.fetch = async input => {
    lookups++;
    const codes = new URL(input).searchParams.get('codes')?.split(',');
    assert(codes?.length, 'ordinary lookups must never request all templates');
    providerCodes.push(...codes);
    return Response.json({ allTemplates: codes.map(detail) });
  };
}
test('fresh code snapshot is persisted and reused across calls without another provider request', async () => {
  reset(); assert.equal((await getRelayTemplateCatalog(['ACTIVE_A'])).allTemplates.length, 1);
  assert.equal(lookups, 1); assert.equal(cache.size, 1);
  assert.equal((await getRelayTemplateCatalog(['ACTIVE_A'])).allTemplates[0].templateCode, 'ACTIVE_A');
  assert.equal(lookups, 1); assert(Date.parse(cache.get('ACTIVE_A').valid_until) > Date.now());
});
test('100,000 retired codes do not enter an active-code lookup or provider response', async () => {
  reset(); registry.push(...Array.from({ length: 100_000 }, (_, index) => ({ template_code: 'OLD_' + index, scope: 'shop', owner_shop_id: null, retired_at: '2026-10-25T00:00:00Z' })));
  const result = await getRelayTemplateCatalog(['ACTIVE_A']);
  assert.deepEqual(result.allTemplates.map(row => row.templateCode), ['ACTIVE_A']);
  assert.deepEqual(providerCodes, ['ACTIVE_A']); assert.equal(cache.size, 1);
});
test('expired approval and unavailable provider fail closed rather than using an old cached body', async () => {
  reset(); cache.set('ACTIVE_A', { template_code: 'ACTIVE_A', detail: detail('ACTIVE_A'), valid_until: new Date(Date.now() - 1).toISOString() });
  globalThis.fetch = async () => new Response('unavailable', { status: 503 });
  assert.equal(await getRelayTemplateCatalog(['ACTIVE_A']), null);
});
test('cache read failure cannot silently bypass ownership storage, and empty code list causes no provider call', async () => {
  reset(); failCache = true;
  await assert.rejects(getRelayTemplateCatalog(['ACTIVE_A'])); assert.equal(lookups, 0);
  assert.deepEqual((await getRelayTemplateCatalog([])).allTemplates, []); assert.equal(lookups, 0);
});
test('unexpected foreign codes in a provider response are not returned or persisted', async () => {
  reset(); globalThis.fetch = async () => Response.json({ allTemplates: [detail('ACTIVE_A'), detail('FOREIGN')] });
  assert.deepEqual((await getRelayTemplateCatalog(['ACTIVE_A'])).allTemplates.map(row => row.templateCode), ['ACTIVE_A']);
  assert(!cache.has('FOREIGN'));
});
