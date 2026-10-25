import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import ts from "typescript";

const require = createRequire(import.meta.url);
const binding = { verificationRequestId: "11111111-1111-4111-8111-111111111111", providerIdentityVerificationId: "pm_fixture_server_id", verificationState: "a".repeat(64) };
const person = { name: "테스트", birthDate: "19900101", phoneNumber: "01000000000", email: "fixture@example.com" };
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
const tick = () => new Promise(r => setImmediate(r));

// Execute the real TSX component and its event handlers. Hooks/RHF, SDK and HTTP
// are in-process doubles, not a browser/real provider or authentication test.
function harness(kind, options = {}) {
  let cursor = 0, tree;
  const slots = [], effects = [], subscriptions = new Set(), requests = [], sdkCalls = [];
  const values = { ...person, identityVerificationToken: "", password: "Fixture!123", passwordConfirm: "Fixture!123" };
  const hooks = {
    useState(initial) { const index = cursor++; if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial; return [slots[index], next => { slots[index] = typeof next === "function" ? next(slots[index]) : next; }]; },
    useRef(initial) { const index = cursor++; return slots[index] ??= { current: initial }; },
    useMemo(fn) { const index = cursor++; return slots[index] ??= fn(); },
    useEffect(fn, deps) { const index = cursor++; const previous = slots[index]; if (!previous || deps.some((d, i) => d !== previous.deps[i])) { effects.push(() => { previous?.cleanup?.(); slots[index] = { deps, cleanup: fn() }; }); } },
  };
  const setValue = (name, value) => { values[name] = value; for (const fn of subscriptions) fn(values, { name }); };
  const form = {
    register: name => ({ name, onChange: event => setValue(name, event.target.value) }),
    handleSubmit: handler => () => handler({ ...values }), getValues: () => ({ ...values }), setValue,
    watch: fn => { subscriptions.add(fn); return { unsubscribe: () => subscriptions.delete(fn) }; },
    trigger: async fields => !fields.includes("email") || /^[^@]+@[^@]+\.[^@]+$/.test(values.email),
    formState: { errors: {}, isSubmitting: false },
  };
  const fetchImpl = async (url, init) => {
    const body = init?.body ? JSON.parse(init.body) : undefined;
    requests.push({ url, body });
    if (options.fetch) { const response = await options.fetch(url, body); if (response) return response; }
    if (url.startsWith("/api/auth/check-email")) return Response.json({ available: false });
    if (url.endsWith("request-verification-code")) return Response.json(body.method === "local" ? { verificationRequestId: binding.verificationRequestId, devVerificationCode: "123456" } : { ...binding, ...options.binding });
    if (url.endsWith("verify-pass") || url.endsWith("verify-identity")) return Response.json({ verificationToken: "fixture-token" });
    if (url.endsWith("find-email")) return Response.json({ email: "fixture@example.com" });
    if (url.endsWith("reset-password")) return Response.json({ message: "fixture reset success" });
    throw new Error("Unexpected request: " + url);
  };
  const mocks = {
    react: hooks, "react-hook-form": { useForm: () => form },
    "next/navigation": { useRouter: () => ({ replace() {}, refresh() {} }) },
    "next/link": { default: "a" }, "lucide-react": { Eye: "eye", EyeOff: "eyeoff" },
    "@hookform/resolvers/zod": { zodResolver: schema => schema },
    "@/components/ui/mobile-back-button": { MobileBackButton: "back" },
    "@/lib/env": { env: { portoneStoreId: "fixture-store", portoneIdentityChannelKey: "fixture-channel" }, hasPortoneBrowserEnv: () => true, getSupabaseRuntimeStage: () => options.development ? "development" : "production" },
    "@portone/browser-sdk/v2": { requestIdentityVerification: async input => { sdkCalls.push(input); return options.sdk ? options.sdk(input) : { identityVerificationId: input.identityVerificationId }; } },
  };
  function load(file) {
    const exports = {};
    const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("exports", "require", "fetch", "window", js)(exports, id => {
      if (id in mocks) return mocks[id];
      if (id.startsWith("@/")) return load(resolve("src", id.slice(2) + ".ts"));
      return require(id);
    }, fetchImpl, { setTimeout: () => 0 });
    return exports;
  }
  const Component = load(resolve(`src/components/auth/${kind === "find" ? "find-email" : "reset-password"}-form.tsx`)).default;
  function render() { cursor = 0; tree = Component(kind === "reset" ? { ready: true } : {}); effects.splice(0).forEach(fn => fn()); return tree; }
  function nodes(node = tree) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(n => nodes(n)); return [node, ...nodes(node.props?.children ?? null)]; }
  function text(node) { if (typeof node === "string") return node; if (Array.isArray(node)) return node.map(text).join(""); return node?.props ? text(node.props.children) : ""; }
  function click(label) { const button = nodes().find(n => n.type === "button" && text(n) === label); assert.ok(button, label); button.props.onClick(); }
  async function settle() { for (let i = 0; i < 15; i++) await tick(); render(); }
  render();
  return { requests, sdkCalls, values, setValue, render, settle, click, nodes, text: () => text(tree),
    back: () => nodes().find(n => n.type === "back").props.onClick(),
    submit: () => nodes().find(n => n.type === "form").props.onSubmit(),
    start: () => click(options.development && kind === "find" ? "휴대폰 본인인증" : "휴대폰으로 본인 인증하기"),
    unmount: () => slots.forEach(slot => slot?.cleanup?.()),
  };
}

for (const kind of ["find", "reset"]) {
  test(`${kind}: server binding, identity payload, SDK state and successful token`, async () => {
    const h = harness(kind); h.start(); await h.settle();
    const request = h.requests.find(r => r.url.endsWith("request-verification-code")).body;
    for (const field of ["name", "birthDate", "phoneNumber"]) assert.equal(request[field], person[field]);
    assert.equal(h.sdkCalls[0].identityVerificationId, binding.providerIdentityVerificationId);
    assert.equal(JSON.parse(h.sdkCalls[0].customData).petmanagerIdentityState, binding.verificationState);
    const verify = h.requests.find(r => r.url.endsWith("verify-pass")).body;
    assert.equal(verify.verificationState, binding.verificationState);
    assert.equal(verify.identityVerificationId, binding.providerIdentityVerificationId);
    assert.equal(h.values.identityVerificationToken, "fixture-token");
    if (kind === "reset") { assert.equal(request.email, person.email); assert.match(h.text(), /새 비밀번호/); }
    h.unmount();
  });
  for (const field of ["verificationState", "providerIdentityVerificationId", "verificationRequestId"]) {
    test(`${kind}: rejects missing ${field} before SDK`, async () => {
      const h = harness(kind, { binding: { [field]: null } }); h.start(); await h.settle(); assert.equal(h.sdkCalls.length, 0); assert.equal(h.values.identityVerificationToken, ""); h.unmount();
    });
  }
  for (const result of [undefined, { code: "USER_CANCEL", identityVerificationId: binding.providerIdentityVerificationId }, { identityVerificationId: "wrong-id" }]) {
    test(`${kind}: SDK cancellation/error/mismatch fails closed ${JSON.stringify(result)}`, async () => {
      const h = harness(kind, { sdk: async () => result }); h.start(); await h.settle(); assert.equal(h.requests.filter(r => r.url.endsWith("verify-pass")).length, 0); assert.equal(h.values.identityVerificationToken, ""); h.unmount();
    });
  }
  test(`${kind}: duplicate click and changed identity invalidate a late SDK result`, async () => {
    const d = deferred(); const h = harness(kind, { sdk: () => d.promise }); h.start(); h.start(); await h.settle(); assert.equal(h.sdkCalls.length, 1);
    h.setValue("phoneNumber", "01000000001"); d.resolve({ identityVerificationId: binding.providerIdentityVerificationId }); await h.settle();
    assert.equal(h.requests.filter(r => r.url.endsWith("verify-pass")).length, 0); assert.equal(h.values.identityVerificationToken, ""); h.unmount();
  });
  test(`${kind}: late verification token after identity edit is ignored`, async () => {
    const d = deferred(); const h = harness(kind, { fetch: url => url.endsWith("verify-pass") ? d.promise : null }); h.start(); await h.settle();
    h.setValue("name", "다른이름"); d.resolve(Response.json({ verificationToken: "stale-token" })); await h.settle(); assert.equal(h.values.identityVerificationToken, ""); h.unmount();
  });
  test(`${kind}: successful verification is revoked on identity change`, async () => {
    const h = harness(kind); h.start(); await h.settle(); h.setValue(kind === "reset" ? "email" : "birthDate", kind === "reset" ? "other@example.com" : "19910101"); h.render(); assert.equal(h.values.identityVerificationToken, ""); if (kind === "reset") assert.doesNotMatch(h.text(), /새 비밀번호 설정/); h.unmount();
  });
  test(`${kind}: invalid identity never starts HTTP`, async () => {
    const h = harness(kind); h.setValue("birthDate", "1990"); h.render(); h.start(); await h.settle(); assert.equal(h.requests.length, 0); h.unmount();
  });
  test(`${kind}: unmounted request never opens SDK`, async () => {
    const d = deferred(); const h = harness(kind, { fetch: url => url.endsWith("request-verification-code") ? d.promise : null }); h.start(); await h.settle(); h.unmount(); d.resolve(Response.json(binding)); await h.settle(); assert.equal(h.sdkCalls.length, 0);
  });
  test(`${kind}: final submission preserves the verified identity and existing form payload`, async () => {
    const h = harness(kind); h.start(); await h.settle(); await h.submit(); await h.settle();
    const last = h.requests.at(-1);
    assert.equal(last.url, kind === "find" ? "/api/auth/find-email" : "/api/auth/reset-password");
    assert.equal(last.body.identityVerificationToken, "fixture-token"); assert.equal(last.body.name, person.name);
    if (kind === "reset") { assert.equal(last.body.email, person.email); assert.equal(last.body.password, "Fixture!123"); }
    h.unmount();
  });
  test(`${kind}: identity edit prevents final submission with a previously verified token`, async () => {
    const h = harness(kind); h.start(); await h.settle(); const count = h.requests.length;
    h.setValue("name", "변경됨"); h.render(); await h.submit(); await h.settle(); assert.equal(h.requests.length, count); h.unmount();
  });
  test(`${kind}: new attempt cannot be overwritten by an earlier SDK completion`, async () => {
    const old = deferred(); let calls = 0;
    const h = harness(kind, { sdk: input => ++calls === 1 ? old.promise : Promise.resolve({ identityVerificationId: input.identityVerificationId }) });
    h.start(); await h.settle(); h.setValue("phoneNumber", "01000000001"); h.render(); h.start(); await h.settle();
    assert.equal(h.values.identityVerificationToken, "fixture-token");
    old.resolve({ identityVerificationId: "wrong-id" }); await h.settle();
    assert.equal(h.values.identityVerificationToken, "fixture-token"); assert.equal(h.requests.filter(r => r.url.endsWith("verify-pass")).length, 1); h.unmount();
  });
  for (const failure of ["request-verification-code", "verify-pass"]) {
    test(`${kind}: ${failure} failure clears token and permits retry`, async () => {
      let fail = true;
      const h = harness(kind, { fetch: url => fail && url.endsWith(failure) ? Response.json({ message: "fixture failure" }, { status: 500 }) : null });
      h.start(); await h.settle(); assert.equal(h.values.identityVerificationToken, "");
      fail = false; h.start(); await h.settle(); assert.equal(h.values.identityVerificationToken, "fixture-token"); h.unmount();
    });
  }
}

test("reset: back during provider preparation cancels a late result", async () => {
  const d = deferred(); const h = harness("reset", { sdk: () => d.promise });
  h.start(); await h.settle(); h.back(); h.render(); d.resolve({ identityVerificationId: binding.providerIdentityVerificationId }); await h.settle();
  assert.equal(h.values.identityVerificationToken, ""); assert.equal(h.requests.filter(r => r.url.endsWith("verify-pass")).length, 0); h.unmount();
});

test("find: development code request and verification keep existing endpoint contract", async () => {
  const h = harness("find", { development: true }); h.click("인증번호 받기"); await h.settle(); h.click("인증 확인"); await h.settle();
  assert.equal(h.requests[0].body.method, "local"); assert.equal(h.requests[1].url, "/api/auth/verify-identity"); assert.equal(h.requests[1].body.verificationRequestId, binding.verificationRequestId); assert.equal(h.values.identityVerificationToken, "fixture-token"); h.unmount();
});
