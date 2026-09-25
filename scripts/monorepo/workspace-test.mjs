import assert from 'node:assert/strict';
import { readFileSync, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = file => readFileSync(path.join(root, file), 'utf8').replace(/^\uFEFF/, '');
const json = file => JSON.parse(read(file));
const require = createRequire(import.meta.url);

test('웹과 모바일은 동일한 실제 계약 파일을 사용한다', () => {
  const canonical = realpathSync(path.join(root, 'apps/shared/contracts/alimtalk.ts'));
  for (const app of ['web', 'mobile']) {
    const project = `apps/${app}`;
    const alias = json(`${project}/tsconfig.json`).compilerOptions.paths['@petmanager/shared/*'][0];
    assert.equal(realpathSync(path.resolve(root, project, alias.replace('*', 'contracts/alimtalk.ts'))), canonical);
    assert.match(read(`${project}/src/lib/notification-registry.ts`), /from "@petmanager\/shared\/contracts\/alimtalk"/);
    assert.equal(existsSync(path.join(root, project, 'packages/alimtalk-contract')), false);
  }
});
test('두 앱이 공통 소스를 묶음 및 배포 추적 범위에 포함한다', () => {
  for (const app of ['web', 'mobile']) {
    const config = read(`apps/${app}/next.config.ts`);
    assert.match(config, /turbopack: \{ root: path.resolve\(__dirname, "\.\.\/\.\."\) \}/);
    assert.match(config, /outputFileTracingRoot: path.resolve\(__dirname, "\.\.\/\.\."\)/);
    assert.match(config, /transpilePackages: \["@petmanager\/shared"\]/);
  }
});
test('공유 DB 변경 이력은 루트에만 둔다', () => {
  assert.ok(existsSync(path.join(root, 'supabase/migrations')));
  for (const app of ['web', 'mobile']) {
    assert.equal(existsSync(path.join(root, `apps/${app}/supabase`)), false);
  }
});
test('개인 설정과 복구본은 Git 제외 대상이다', () => {
  const ignore = read('.gitignore');
  for (const pattern of ['.env.local', '.migration-backup/', '*.jks', '*.keystore']) {
    assert.ok(ignore.includes(pattern), pattern);
  }
});
test('하나의 npm workspace와 잠금 파일이 두 앱 및 공통 계약을 연결한다', () => {
  const pkg = json('package.json');
  assert.deepEqual(pkg.workspaces, ['apps/web', 'apps/mobile', 'apps/shared']);
  const lock = json('package-lock.json');
  for (const app of ['web', 'mobile']) {
    assert.equal(json(`apps/${app}/package.json`).dependencies['@petmanager/shared'], '0.0.0');
    assert.equal(lock.packages[`apps/${app}`].name, `@petmanager/${app}`);
    assert.equal(existsSync(path.join(root, `apps/${app}/.git`)), false);
  }
  assert.equal(lock.packages['node_modules/@petmanager/shared'].resolved, 'apps/shared');
  assert.equal(lock.packages['packages/contracts'], undefined);
});

test('공통 UI 구현은 한곳에 있고 앱에는 스타일 선택/연결만 남는다', () => {
  for (const name of ['app-button', 'app-input', 'form-field', 'mobile-back-button']) {
    const source = read(`apps/shared/components/${name}.tsx`);
    assert.doesNotMatch(source, /from ["']@\//);
    assert.doesNotMatch(source, /(?:\.\.\/)+(?:web|mobile)\//);
    for (const app of ['web', 'mobile']) {
      const adapter = read(`apps/${app}/src/components/ui/${name}.tsx`);
      assert.ok(adapter.includes(`@petmanager/shared/components/${name}`));
      assert.doesNotMatch(adapter, /function|className=|return\s*\(/);
    }
  }
});

test('웹과 모바일의 스타일 생성 범위에 공통 UI가 포함된다', () => {
  for (const app of ['web', 'mobile']) {
    const css = read(`apps/${app}/src/app/globals.css`);
    assert.ok(css.includes('@source "../../../shared/components";'));
    assert.equal(realpathSync(path.resolve(root, `apps/${app}/src/app/../../../shared/components`)), realpathSync(path.join(root, 'apps/shared/components')));
  }
});

test('공통 폴더 이동은 알림톡 확정 본문을 바꾸지 않는다', () => {
  assert.equal(read('apps/shared/contracts/alimtalk.ts').replaceAll('\r\n', '\n').trimEnd(), read('packages/alimtalk-contract/index.ts').replaceAll('\r\n', '\n').trimEnd());
});

for (const app of ['web', 'mobile']) {
  test(`${app}: 실제 CSS 생성 결과에 공통 버튼·입력 항목 스타일이 포함된다`, async () => {
    const postcss = require('postcss');
    const tailwind = require('@tailwindcss/postcss');
    const project = path.join(root, 'apps', app);
    const from = path.join(project, 'src/app/globals.css');
    const result = await postcss([tailwind({ base: project, optimize: false })]).process(readFileSync(from, 'utf8'), { from });
    const selectors = [];
    result.root.walkRules(rule => selectors.push(rule.selector));
    for (const selector of ['.h-8', '.min-h-11', '0_6px_16px_rgba', '.space-y-1\\.5']) {
      assert.ok(selectors.some(value => value.includes(selector)), `Shared CSS missing: ${selector}`);
    }
  });
}
