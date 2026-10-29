const assert = require('node:assert/strict');
const test = require('node:test');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
function loadTypeScript(file, globals = {}) {
  const output = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  const runtime = { exports: {} };
  Function('require', 'module', 'exports', ...Object.keys(globals), output)(require, runtime, runtime.exports, ...Object.values(globals));
  return runtime.exports;
}
const { projectOwnerStartupBootstrap: project } = loadTypeScript('../../apps/shared/lib/owner-startup-projection.ts');
const { beginOwnerStartupReadOnly, assertOwnerStartupWriteReady, getOwnerStartupRevision, invalidateOwnerStartupRevision } = loadTypeScript('../../apps/shared/lib/owner-startup-write-fence.ts');
const { OWNER_PUBLIC_SHELL_WORKER: source } = loadTypeScript('../../apps/shared/lib/owner-public-shell.ts');
const { ownerStartupPrincipalHint } = loadTypeScript('../../apps/shared/lib/owner-startup-store.ts');

function fixture() {
  return {
    mode: 'supabase', actor: { shopId: 'shop-a', userId: 'user-a', role: 'owner', staffId: null },
    shop: { id: 'shop-a', name: 'Booking fixture' },
    ownerProfile: { birth_date: 'PRIVATE_OWNER_IDENTITY' },
    guardians: [{ id: 'guardian-a', shop_id: 'shop-a', name: 'Guardian', phone: '01000000000', memo: 'PRIVATE_GUARDIAN_MEMO' }],
    pets: [{ id: 'pet-a', shop_id: 'shop-a', guardian_id: 'guardian-a', name: 'Pet', notes: 'PRIVATE_PET_NOTES' }],
    services: [{ id: 'service-a', shop_id: 'shop-a' }],
    staffMembers: [{ id: 'staff-a', name: 'Staff', phone: 'PRIVATE_STAFF_PHONE', profileImageUrl: 'PRIVATE_IMAGE' }],
    appointments: [{ id: 'appointment-a', shop_id: 'shop-a', guardian_id: 'guardian-a', pet_id: 'pet-a', service_id: 'service-a', staff_id: 'staff-a', status: 'confirmed', memo: 'PRIVATE_APPOINTMENT_MEMO' }],
    groomingRecords: [{ id: 'record-a', shop_id: 'shop-a', care_report_data: { reportText: 'PRIVATE_REPORT' } }],
    notifications: [{ message: 'PRIVATE_MESSAGE' }], landingInterests: [], landingFeedback: [{ message: 'PRIVATE_FEEDBACK' }],
    unknownFutureField: 'PRIVATE_FUTURE_FIELD',
  };
}

test('startup projection retains canonical booking identities and omits unrelated private material', () => {
  const input = fixture();
  const output = project(input);
  assert.equal(output.actor.userId, input.actor.userId);
  assert.equal(output.appointments[0].id, input.appointments[0].id);
  assert.equal(output.guardians[0].phone, input.guardians[0].phone);
  assert.equal(output.pets[0].guardian_id, input.guardians[0].id);
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE_/);
  assert.match(JSON.stringify(input), /PRIVATE_/);
});

test('partial presentation never mounts an editor or asserts omitted notes are empty', () => {
  const { createElement } = require('react');
  const { renderToStaticMarkup } = require('react-dom/server');
  const { OwnerStartupDetailsBoundary } = loadTypeScript('../../apps/shared/components/owner-startup-details-boundary.tsx');
  let mounts = 0;
  function Editor() { mounts += 1; return createElement('textarea', { defaultValue: 'CANONICAL_EXISTING_NOTE' }); }
  const pending = renderToStaticMarkup(createElement(OwnerStartupDetailsBoundary, { pending: true, title: 'Booking details', embedded: true }, createElement(Editor)));
  assert.equal(mounts, 0);
  assert.doesNotMatch(pending, /textarea|CANONICAL_EXISTING_NOTE|no memo/i);
  const live = renderToStaticMarkup(createElement(OwnerStartupDetailsBoundary, { pending: false, title: 'Booking details' }, createElement(Editor)));
  assert.equal(mounts, 1);
  assert.match(live, /CANONICAL_EXISTING_NOTE/);
});

test('invalidation during scope hashing aborts a pre-clear write before it can open IndexedDB', async () => {
  const values = new Map(); let nonce = 0, opens = 0, resolveDigest;
  const window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  const crypto = { randomUUID: () => 'stamp-' + (++nonce), subtle: { digest: () => new Promise(resolve => { resolveDigest = resolve; }) } };
  const indexedDB = { open() { opens += 1; throw new Error('fixture database unavailable'); } };
  const store = loadTypeScript('../../apps/shared/lib/owner-startup-store.ts', { window, crypto, indexedDB });
  const writing = store.writeOwnerStartupSnapshot({ principalId: 'user-a', shopId: 'shop-a' }, { id: 'pre-clear-row' });
  await assert.rejects(store.clearOwnerStartupSnapshots(), /fixture database unavailable/);
  resolveDigest(new ArrayBuffer(32));
  await writing;
  assert.equal(opens, 1, 'only the clearing operation may touch IDB after invalidation');
});

test('a missing list is never converted into an authoritative empty list', () => {
  for (const name of ['guardians', 'pets', 'services', 'appointments', 'groomingRecords', 'staffMembers']) {
    const value = fixture(); delete value[name];
    assert.throws(() => project(value), /complete canonical/);
  }
});

test('mixed shops, unknown principals, mock data and unassigned staff rows are rejected', () => {
  for (const name of ['guardians', 'pets', 'services', 'appointments', 'groomingRecords']) {
    const value = fixture(); value[name][0].shop_id = 'shop-b';
    assert.throws(() => project(value), /another shop/);
  }
  const noPrincipal = fixture(); delete noPrincipal.actor.userId;
  assert.throws(() => project(noPrincipal), /canonical scoped/);
  assert.throws(() => project({ ...fixture(), mode: 'mock' }), /canonical scoped/);
  const staff = fixture(); staff.actor.role = 'staff'; staff.actor.staffId = 'staff-b';
  assert.throws(() => project(staff), /staff scope/);
});

test('startup write fence permits reads and releases only its own outstanding leases', () => {
  const releaseA = beginOwnerStartupReadOnly();
  const releaseB = beginOwnerStartupReadOnly();
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.doesNotThrow(() => assertOwnerStartupWriteReady(method));
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE', 'post']) assert.throws(() => assertOwnerStartupWriteReady(method));
  releaseA(); releaseA();
  assert.throws(() => assertOwnerStartupWriteReady('POST'));
  releaseB();
  assert.doesNotThrow(() => assertOwnerStartupWriteReady('POST'));
});

test('reads preserve the revision while writes and access denials invalidate older startup responses', () => {
  const before = getOwnerStartupRevision();
  assertOwnerStartupWriteReady('GET');
  assert.equal(getOwnerStartupRevision(), before);
  assertOwnerStartupWriteReady('POST');
  assert.ok(getOwnerStartupRevision() > before);
  const beforeDenial = getOwnerStartupRevision();
  invalidateOwnerStartupRevision();
  assert.ok(getOwnerStartupRevision() > beforeDenial);
});

test('expired JWT subjects are presentation lookup hints only and malformed hints fail closed', () => {
  const token = payload => 'e30.' + Buffer.from(JSON.stringify(payload)).toString('base64url') + '.unverified';
  assert.equal(ownerStartupPrincipalHint(token({ sub: 'user-a', exp: 1 })), 'user-a');
  for (const value of [null, 'invalid', token({ sub: 1 }), token({ sub: ' user-a ' }), token({})]) assert.equal(ownerStartupPrincipalHint(value), null);
});

for (const app of ['mobile', 'web']) test(app + ' presentation hints honor account changes and logout without reviving a leftover handoff', () => {
  const storage = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; };
  const window = { localStorage: storage(), sessionStorage: storage() };
  const token = sub => 'e30.' + Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url') + '.fixture';
  const source = fs.readFileSync(path.resolve(__dirname, '../../apps/' + app + '/src/lib/auth/owner-auth-handoff.ts'), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const runtime = { exports: {} };
  const modules = { ownerStartupPrincipalHint, clearOwnerStartupSnapshots: async () => {} };
  Function('require', 'module', 'exports', 'window', output)(name => { assert.equal(name, '@petmanager/shared/lib/owner-startup-store'); return modules; }, runtime, runtime.exports, window);
  const api = runtime.exports;
  api.writeOwnerAuthTokenCache(token('user-a'));
  assert.equal(api.readOwnerStartupPrincipalHint(), 'user-a');
  window.localStorage.setItem('petmanager.ownerAuthHandoff', JSON.stringify({ accessToken: token('user-b') }));
  assert.equal(api.readOwnerStartupPrincipalHint(), 'user-b');
  api.clearOwnerAuthTokenCache();
  window.sessionStorage.setItem('petmanager.ownerAuthTokenCache', JSON.stringify({ accessToken: token('user-a'), expiresAt: Date.now() + 3600_000 }));
  assert.equal(api.readOwnerStartupPrincipalHint(), null);
});

function workerHarness() {
  const handlers = new Map(), cache = new Map(), calls = [], pending = [];
  let documentResponse = new Response('<html><script src="/_next/static/chunks/home-a.js"></script></html>', { headers: { 'Content-Type': 'text/html', 'X-PetManager-Public-Owner-Shell': '1' } });
  let failAsset = false;
  const key = value => typeof value === 'string' ? value : value.url;
  const storage = { async match(value) { return cache.get(key(value))?.clone(); }, async put(value, response) { cache.set(key(value), response.clone()); }, async keys() { return [...cache.keys()].map(url => new Request(url)); }, async delete(value) { return cache.delete(key(value)); } };
  const context = {
    self: { location: { origin: 'https://fixture.invalid' }, skipWaiting: async () => {}, clients: { claim: async () => {} }, addEventListener(name, handler) { handlers.set(name, handler); } },
    URL, Request, Response, Map, Set, Promise, caches: { open: async () => storage },
    fetch: async (value) => {
      const url = key(value); calls.push(url);
      if (new URL(url).pathname.startsWith('/_next/static/')) return new Response('public js', { status: failAsset ? 503 : 200 });
      return documentResponse.clone();
    },
  };
  vm.runInNewContext(source, context);
  const message = async path => {
    handlers.get('message')({ data: { type: 'PREPARE_PUBLIC_OWNER_SHELL', path }, waitUntil(p) { pending.push(p); } });
    await Promise.all(pending.splice(0));
  };
  return { cache, calls, message, handlers, pending, setDocument(response) { documentResponse = response; }, failAssets() { failAsset = true; } };
}

test('public shell worker never intercepts API, Auth, RSC or mutations', async () => {
  const worker = workerHarness();
  for (const [url, method] of [
    ['https://fixture.invalid/api/owner/entry', 'GET'], ['https://fixture.invalid/api/appointments', 'POST'],
    ['https://supabase.invalid/auth/v1/token', 'GET'], ['https://fixture.invalid/owner/mobile?_rsc=abc', 'GET'],
  ]) {
    worker.handlers.get('fetch')({ request: new Request(url, { method }), respondWith() { assert.fail('private request intercepted'); } });
  }
  await worker.message('/api/bootstrap');
  assert.equal(worker.calls.length, 0);
});

test('public HTML is cached only with the explicit opt-in and all first-render assets available', async () => {
  const worker = workerHarness();
  await worker.message('/owner/mobile');
  assert.ok(worker.cache.has('https://fixture.invalid/owner/mobile'));
  assert.ok(worker.cache.has('https://fixture.invalid/_next/static/chunks/home-a.js'));
  worker.setDocument(new Response('<html>private</html>', { headers: { 'Content-Type': 'text/html' } }));
  await worker.message('/owner');
  assert.equal(worker.cache.has('https://fixture.invalid/owner'), false);
  worker.setDocument(new Response('<html><script src="/_next/static/chunks/new.js"></script></html>', { headers: { 'Content-Type': 'text/html', 'X-PetManager-Public-Owner-Shell': '1' } }));
  worker.failAssets();
  await worker.message('/owner/mobile');
  assert.match(await worker.cache.get('https://fixture.invalid/owner/mobile').text(), /home-a/);
});

test('public asset cleanup bounds obsolete generations without deleting current startup files', async () => {
  const worker = workerHarness();
  for (let i = 0; i < 400; i++) worker.cache.set('https://fixture.invalid/_next/static/chunks/old-' + i + '.js', new Response('old public js'));
  await worker.message('/owner/mobile');
  assert.ok(worker.cache.size <= 384);
  assert.ok(worker.cache.has('https://fixture.invalid/owner/mobile'));
  assert.ok(worker.cache.has('https://fixture.invalid/_next/static/chunks/home-a.js'));
});

module.exports = { fixture };
