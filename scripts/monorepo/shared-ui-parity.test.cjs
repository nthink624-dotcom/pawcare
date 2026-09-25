const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { createHash } = require('node:crypto');
const { clsx } = require('clsx');
const { twMerge } = require('tailwind-merge');
const root = path.resolve(__dirname, '../..');
const cn = (...args) => twMerge(clsx(args));
const hash = s => createHash('sha256').update(s).digest('hex');

function load(file) {
  const source = fs.readFileSync(file, 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const loaded = { exports: {} };
  Function('require', 'module', 'exports', output)(specifier => {
    if (specifier === '@/lib/utils' || specifier === '../lib/cn') return { cn };
    return require(specifier);
  }, loaded, loaded.exports);
  return loaded.exports;
}
const cases = [];
for (const variant of ['primary', 'secondary', 'text', 'danger', 'inline']) {
  for (const size of ['default', 'sm']) {
    cases.push({ name: `button-${variant}-${size}`, file: 'app-button', component: 'AppButton', props: { variant, size, children: '확인', fullWidth: size === 'sm', disabled: variant === 'danger', className: 'custom-action', 'aria-label': '예약 확인' } });
  }
}
cases.push(
  { name: 'button-defaults', file: 'app-button', component: 'AppButton', props: { children: '확인' } },
  { name: 'button-override', file: 'app-button', component: 'AppButton', props: { children: '전송', type: 'submit', className: 'h-20 text-[20px] w-full', 'data-test': 'action' } },
  { name: 'input-defaults', file: 'app-input', component: 'AppInput', props: {} },
  { name: 'input-error-disabled', file: 'app-input', component: 'AppInput', props: { type: 'email', disabled: true, placeholder: '입력해 주세요', 'aria-invalid': true, defaultValue: 'example', className: 'h-14 border-red-500' } },
  { name: 'field-required-helper', file: 'form-field', component: 'FormField', props: { label: '이름', htmlFor: 'name', required: true, helperText: '입력 안내', children: React.createElement('input', { id: 'name' }) } },
  { name: 'field-error-priority', file: 'form-field', component: 'FormField', props: { label: '이름', helperText: '안내', errorText: '필수 입력', children: '내용' } },
  { name: 'field-unlabelled', file: 'form-field', component: 'FormField', props: { className: 'space-y-4', children: '내용' } },
  { name: 'back-defaults', file: 'mobile-back-button', component: 'MobileBackButton', props: {} },
  { name: 'back-disabled', file: 'mobile-back-button', component: 'MobileBackButton', props: { label: '이전 단계', disabled: true, type: 'submit', className: 'h-12' } },
  { name: 'back-link', file: 'mobile-back-button', component: 'MobileBackLinkButton', props: { href: '/owner', prefetch: false } },
  { name: 'back-anchor', file: 'mobile-back-button', component: 'MobileBackAnchorButton', props: { href: '#top', children: '처음으로', label: '처음', className: 'h-10' } },
);

if (process.argv.includes('--capture-before')) {
  // Only run while the protected pre-extraction snapshot is available.
  const snapshot = {};
  for (const app of ['web', 'mobile']) {
    for (const scenario of cases) {
      const original = load(path.join(root, `.migration-backup/20260925/shared-layout/${app}/${scenario.file}.tsx`));
      snapshot[`${app}:${scenario.name}`] = hash(renderToStaticMarkup(React.createElement(original[scenario.component], scenario.props)));
    }
  }
  const destination = path.join(__dirname, 'shared-ui-before.json');
  if (fs.existsSync(destination)) throw new Error('Baseline already captured; do not silently accept new output.');
  process.stdout.write('*** Begin Patch\n*** Add File: ' + destination + '\n' + JSON.stringify(snapshot, null, 2).split('\n').map(s => '+' + s).join('\n') + '\n*** End Patch\n');
} else {
  const before = JSON.parse(fs.readFileSync(path.join(__dirname, 'shared-ui-before.json'), 'utf8'));
  for (const [app, prefix] of [['web', 'Web'], ['mobile', 'Mobile']]) {
    for (const scenario of cases) {
      test(`${app}: ${scenario.name}의 HTML·스타일·접근성 속성이 원본과 같다`, () => {
        const shared = load(path.join(root, `apps/shared/components/${scenario.file}.tsx`));
        const name = ['AppButton', 'AppInput'].includes(scenario.component) ? prefix + scenario.component : scenario.component;
        assert.equal(hash(renderToStaticMarkup(React.createElement(shared[name], scenario.props))), before[`${app}:${scenario.name}`]);
      });
    }
  }
  test('공통 버튼과 입력창이 이벤트·ref를 그대로 DOM에 전달한다', () => {
    for (const [file, name, eventKey] of [['app-button', 'AppButton', 'onClick'], ['app-input', 'AppInput', 'onChange']]) {
      const shared = load(path.join(root, `apps/shared/components/${file}.tsx`));
      for (const prefix of ['Web', 'Mobile']) {
        const handler = () => {};
        const ref = { current: null };
        const element = shared[prefix + name].render({ children: '내용', [eventKey]: handler }, ref);
        assert.equal(element.props[eventKey], handler);
        assert.equal(element.props.ref, ref);
      }
    }
  });
}
