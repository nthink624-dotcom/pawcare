const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const test = require('node:test');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');

function loadConfig(mode) {
  const filename = path.join(root, 'apps/web/next.config.ts');
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  const context = { exports: {}, require, __dirname: path.dirname(filename), process: { env: { NODE_ENV: mode } } };
  vm.runInNewContext(code, context);
  return context.exports.default;
}

for (const mode of ['development', 'production', 'test']) {
  test(`mobile redirect uses the correct origin in ${mode}`, async () => {
    const rules = await loadConfig(mode).redirects();
    const rule = rules.find(rule => rule.source === '/owner/mobile');
    const expected = mode === 'development'
      ? 'http://127.0.0.1:3100/owner/mobile'
      : 'https://app.petmanager.co.kr/owner/mobile';
    assert.equal(rule.destination, expected);
    assert.equal(rule.permanent, false);
    const page = fs.readFileSync(path.join(root, 'apps/web/src/app/owner/mobile/page.tsx'), 'utf8');
    const declaration = page.match(/const MOBILE_OWNER_URL = ([\s\S]*?);/)[1];
    assert.equal(vm.runInNewContext(declaration, { process: { env: { NODE_ENV: mode } } }), expected);
    assert.match(page, /nextUrl.search = window.location.search/);
  });
}

test('mobile services resolve canonical source directories; only web owns cron jobs', () => {
  const mobile = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json')));
  assert.equal(mobile.services.frontend.root, 'apps/mobile');
  assert.equal(mobile.services.backend.root, 'backend');
  for (const service of Object.values(mobile.services)) {
    assert.ok(fs.existsSync(path.join(root, service.root, 'package.json')));
  }
  assert.equal(mobile.crons, undefined);
  assert.equal(mobile.rewrites[0].destination.service, 'backend');
  assert.equal(mobile.rewrites[1].destination.service, 'frontend');
  const web = JSON.parse(fs.readFileSync(path.join(root, 'apps/web/vercel.json')));
  assert.equal(web.framework, 'nextjs');
  assert.equal(web.crons.length, 2);
});
