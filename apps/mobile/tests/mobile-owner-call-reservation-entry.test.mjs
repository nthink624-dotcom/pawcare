import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import test from "node:test";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
const sourceRoot = fileURLToPath(new URL("../src/", import.meta.url));
const cache = new Map();
function loadSource(relative) {
  const filename = [".ts", ".tsx"].map(extension => path.resolve(sourceRoot, `${relative}${extension}`)).find(existsSync);
  if (cache.has(filename)) return cache.get(filename);
  const runtimeModule = { exports: {} };
  cache.set(filename, runtimeModule.exports);
  const output = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInThisContext(`(function(require, module, exports) {${output}\n})`, { filename })(
    (specifier) => specifier.startsWith("@/") ? loadSource(specifier.slice(2)) : require(specifier),
    runtimeModule,
    runtimeModule.exports,
  );
  return runtimeModule.exports;
}

const { findPendingCallGuardian } = loadSource("lib/owner-call-reservation-entry");
const { normalizeCareReport } = loadSource("lib/care-report/normalize-care-report");
const customer = { id: "guardian-a", phone: "010-1234-5678", name: "테스트 고객", deleted_at: null };
const action = { pending: true, providerCallId: "fixture-call", callerNumber: "010 1234 5678" };

test("phone entry opens against the exact authorized customer row", () => {
  assert.equal(findPendingCallGuardian([customer], action), customer);
  assert.equal(findPendingCallGuardian([{ ...customer, id: "other", phone: "010-0000-5678" }], action), null);
});

test("ambiguous or deleted customers do not become a fast-entry fallback", () => {
  assert.equal(findPendingCallGuardian([customer, { ...customer, id: "guardian-b" }], action), null);
  assert.equal(findPendingCallGuardian([{ ...customer, deleted_at: "2026-01-01" }], action), null);
});

test("inactive, missing, and empty caller actions cannot prepare a draft", () => {
  for (const invalid of [null, { ...action, pending: false }, { ...action, providerCallId: "" }, { ...action, callerNumber: "" }]) {
    assert.equal(findPendingCallGuardian([customer], invalid), null);
  }
});

test("the extracted care-report reader preserves existing and legacy formats", () => {
  assert.deepEqual(normalizeCareReport("  잘 마쳤어요.  "), { reportText: "잘 마쳤어요." });
  assert.deepEqual(normalizeCareReport({ oneLineSummary: "요약", treatmentSummary: "요약", homeCareTips: ["관리"] }), { reportText: "요약 관리" });
  assert.equal(normalizeCareReport({ reportText: "x".repeat(5000) }).reportText.length, 4000);
  assert.equal(normalizeCareReport([]), null);
});

const panelData = { shop: { id: "fixture-shop" }, guardians: [customer], pets: [{ id: "pet-a", guardian_id: customer.id, name: "테스트 반려동물" }], services: [{ id: "service-a", name: "기본 미용", duration_minutes: 60, is_active: true }], staffMembers: [] };
function loadCallPanel(source, overrides = {}) {
  const runtimeModule = { exports: {} };
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  const localRequire = (specifier) => {
    if (overrides[specifier]) return overrides[specifier];
    if (specifier === "@/components/owner/owner-app-ui") return { InfoTip: ({ children }) => React.createElement("span", null, children) };
    if (specifier === "@/lib/api") return { fetchApiJsonWithAuth: () => new Promise(() => {}) };
    if (specifier === "@/lib/owner-call-screening") return {};
    return specifier.startsWith("@/") ? loadSource(specifier.slice(2)) : require(specifier);
  };
  vm.runInThisContext(`(function(require, module, exports) {${output}\n})`)(localRequire, runtimeModule, runtimeModule.exports);
  return runtimeModule.exports.default;
}

function renderCallPanel(source) {
  return renderToStaticMarkup(React.createElement(loadCallPanel(source), { data: panelData, pendingReservationAction: action }));
}

test("reservation inputs render before any call-event response while saving stays gated", () => {
  const html = renderCallPanel(readFileSync(path.join(sourceRoot, "components/owner/owner-catch-call-panel.tsx"), "utf8"));
  assert.match(html, /data-call-reservation-form="true"/);
  assert.match(html, /<textarea/);
  assert.doesNotMatch(html, /<textarea[^>]*disabled/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>예약 확정<\/button>/);
});

function createPanelRuntime() {
  const cells = [];
  const effects = [];
  let cursor = 0;
  let completeEvents;
  const eventResponse = new Promise(resolve => { completeEvents = resolve; });
  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { value: typeof initial === "function" ? initial() : initial };
      return [cells[index].value, next => { cells[index].value = typeof next === "function" ? next(cells[index].value) : next; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!cells[index]) cells[index] = { current: initial };
      return cells[index];
    },
    useMemo(compute) { return compute(); },
    useEffect(effect, dependencies) {
      const index = cursor++;
      if (!cells[index] || !dependencies.every((value, position) => Object.is(value, cells[index][position]))) effects.push(effect);
      cells[index] = dependencies;
    },
  };
  const native = {
    isOwnerCallScreeningAvailable: () => false,
    getOwnerCallScreeningStatus: async () => ({ available: false, enabled: false, active: false, phoneStateGranted: false }),
    syncOwnerCallScreeningPhoneAllowlist: async () => undefined,
    clearOwnerCallReservationAction: async () => undefined,
  };
  const Panel = loadCallPanel(readFileSync(path.join(sourceRoot, "components/owner/owner-catch-call-panel.tsx"), "utf8"), {
    react: hooks,
    "@/lib/api": { fetchApiJsonWithAuth: () => eventResponse },
    "@/lib/owner-call-screening": native,
  });
  return {
    render() { cursor = 0; return Panel({ data: panelData, pendingReservationAction: action }); },
    runEffects() { effects.splice(0).forEach(effect => effect()); },
    completeEvents() { completeEvents({ events: [{ id: "event-a", providerEventId: `${action.providerCallId}:incoming`, eventType: "incoming", matchStatus: "matched", matchedGuardian: customer, appointmentId: null, occurredAt: "2026-01-01T00:00:00Z", phoneTail: "5678" }] }); },
  };
}

function findElement(node, predicate) {
  if (!node || typeof node !== "object") return null;
  if (predicate(node)) return node;
  for (const child of React.Children.toArray(node.props?.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

async function flushPromises() {
  for (let i = 0; i < 8; i++) await Promise.resolve();
}

test("a delayed authoritative event enables saving without resetting the entered memo", async () => {
  const runtime = createPanelRuntime();
  let tree = runtime.render();
  runtime.runEffects();
  const textarea = findElement(tree, element => element.type === "textarea");
  textarea.props.onChange({ target: { value: "통화 중 입력한 메모" } });
  tree = runtime.render();
  assert.equal(findElement(tree, element => element.type === "button" && element.props.children === "예약 확정").props.disabled, true);
  runtime.completeEvents();
  await flushPromises();
  tree = runtime.render();
  assert.equal(findElement(tree, element => element.type === "textarea").props.value, "통화 중 입력한 메모");
  assert.equal(findElement(tree, element => element.type === "button" && element.props.children === "예약 확정").props.disabled, false);
});

test("cancelling before event hydration does not reopen the form when the response arrives", async () => {
  const runtime = createPanelRuntime();
  const tree = runtime.render();
  runtime.runEffects();
  findElement(tree, element => element.type === "button" && element.props.children === "취소").props.onClick();
  runtime.completeEvents();
  await flushPromises();
  assert.equal(findElement(runtime.render(), element => element.props?.["data-call-reservation-form"] === "true"), null);
});
