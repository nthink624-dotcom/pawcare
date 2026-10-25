import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
const source = fs.readFileSync(new URL('../src/components/owner/setup-profile-photo-sources.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;

async function harness({ availability = 'available', capture, mobile = false }) {
  const values = []; let index = 0; let effect; let initialized = false;
  const busy = [], files = [], exports = {};
  const jsx = (type, props) => ({ type, props });
  const react = {
    useState: initial => { const slot = index++; if (!(slot in values)) values[slot] = initial; return [values[slot], value => { values[slot] = value; }]; },
    useRef: initial => { const slot = index++; if (!(slot in values)) values[slot] = { current: initial }; return values[slot]; },
    useEffect: fn => { if (!initialized) effect = fn; },
  };
  vm.runInNewContext(compiled, { exports, Error, navigator: { userAgent: mobile ? 'Android' : 'Desktop', platform: 'Win32', maxTouchPoints: 0 }, document: { createElement: () => ({ capture: '' }) }, require: name => {
    if (name === 'react') return react;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'lucide-react') return { Camera: 'camera-icon', ImagePlus: 'album-icon' };
    if (name.includes('external-camera')) return { resolveExternalCameraAppsAvailability: async () => availability, captureWithAndroidCameraApp: capture };
    throw new Error(name);
  } });
  const render = () => { index = 0; return exports.default({ onFile: file => files.push(file), onBusyChange: value => busy.push(value) }); };
  render(); effect(); initialized = true; await new Promise(resolve => setImmediate(resolve));
  const nodes = tree => !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(nodes) : [tree, ...nodes(tree.props?.children)];
  const buttons = () => nodes(render()).filter(node => node.type === 'button');
  const alerts = () => nodes(render()).filter(node => node.props?.role === 'alert');
  return { buttons, alerts, files, busy };
}

test('native capture blocks duplicate launch and releases navigation before file handoff', async () => {
  let finish, calls = 0;
  const h = await harness({ capture: () => { calls++; return new Promise(resolve => { finish = resolve; }); } });
  h.buttons()[0].props.onClick(); h.buttons()[0].props.onClick();
  assert.equal(calls, 1); assert.equal(h.buttons()[1].props.disabled, true);
  assert.deepEqual(h.busy, [true]);
  const photo = { name: 'photo.jpg' }; finish(photo); await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(h.busy, [true, false]); assert.deepEqual(h.files, [photo]);
});
test('camera denial allows album retry; cancellation does not show failure', async () => {
  for (const message of ['CAMERA_PERMISSION_DENIED', 'CAMERA_CANCELLED']) {
    const h = await harness({ capture: async () => { throw new Error(message); } });
    h.buttons()[0].props.onClick(); await new Promise(resolve => setImmediate(resolve));
    assert.equal(h.buttons()[1].props.disabled, false); assert.equal(h.files.length, 0);
    assert.equal(h.alerts().length, message === 'CAMERA_CANCELLED' ? 0 : 1);
    assert.deepEqual(h.busy, [true, false]);
  }
});
test('desktop and unavailable native cameras keep album selection available', async () => {
  for (const availability of ['web', 'plugin-unavailable', 'camera-unavailable']) {
    const h = await harness({ availability });
    assert.equal(h.buttons()[0].props.disabled, true); assert.equal(h.buttons()[1].props.disabled, false);
  }
  const mobile = await harness({ availability: 'web', mobile: true });
  assert.equal(mobile.buttons()[0].props.disabled, false);
});
