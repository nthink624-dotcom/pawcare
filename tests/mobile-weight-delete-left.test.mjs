import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(path, mocks = {}, browser = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("exports", "require", "window", code)(exports, id => {
    if (id in mocks) return mocks[id];
    if (id.startsWith("@/") || id.startsWith("./")) throw Error(`Unexpected import ${id}`);
    return require(id);
  }, browser);
  return exports;
}
const adapter = load("../src/lib/price-photo/mobile-price-photo-adapter.ts");
const matrix = load("../src/lib/price-photo/mobile-price-guide-matrix.ts", { "./mobile-price-photo-adapter": adapter });
function harness(confirm = false, initial = matrix.createMobilePriceGuideSkeleton()) {
  let cursor = 0, document = initial, tree, calls = 0;
  const states = [], prompts = [], changed = [];
  const hooks = { useMemo: fn => fn(), useState: initial => { const index = cursor++; if (!(index in states)) states[index] = initial; return [states[index], value => { states[index] = typeof value === "function" ? value(states[index]) : value; }]; }, useRef: value => ({ current: value }) };
  const Component = load("../src/components/auth/mobile-price-guide-matrix.tsx", {
    react: hooks, "lucide-react": { Plus: "plus", Trash2: "trash", X: "close" },
    "@/components/auth/mobile-price-guide-extras": { default: "extras" },
    "@/lib/price-photo/mobile-price-photo-adapter": adapter,
    "@/lib/price-photo/mobile-price-guide-matrix": { ...matrix, removeMobilePriceGuideWeightBand: (...args) => { calls++; return matrix.removeMobilePriceGuideWeightBand(...args); } },
  }, { confirm: message => { prompts.push(message); return confirm; } }).default;
  function render() { cursor = 0; tree = Component({ document, onChange: next => { changed.push(next); document = next; } }); }
  function nodes(node = tree) { if (!node || typeof node !== "object") return []; if (Array.isArray(node)) return node.flatMap(value => nodes(value)); return [node, ...nodes(node.props?.children ?? null)]; }
  render();
  return { render, nodes, prompts, changed, states, get document() { return document; }, get calls() { return calls; },
    cells: () => nodes().filter(node => "data-mobile-weight-cell" in (node.props ?? {})),
    deletes: () => nodes().filter(node => "data-mobile-weight-delete" in (node.props ?? {})),
  };
}

test("cancel keeps document, selected editors and helper calls completely unchanged", () => {
  const h = harness(false, matrix.addMobilePriceGuideWeightBand(matrix.createMobilePriceGuideSkeleton(), 0)), original = structuredClone(h.document);
  const weightButton = h.nodes(h.cells()[0]).find(node => node.type === "button" && !("data-mobile-weight-delete" in node.props));
  weightButton.props.onClick();
  h.nodes().find(node => typeof node.props?.onStartEdit === "function").props.onStartEdit();
  h.render(); const editors = [...h.states];
  h.deletes()[0].props.onClick();
  assert.equal(h.calls, 0); assert.equal(h.changed.length, 0); assert.deepEqual(h.document, original); assert.deepEqual(h.states, editors);
  assert.match(h.prompts[0], /소형견 2kg 이하 구간/); assert.match(h.prompts[0], /모든 서비스 요금이 삭제/);
});

test("confirm removes exactly one weight band using existing helper once and resets index editors", () => {
  let initial = matrix.createMobilePriceGuideSkeleton();
  initial = matrix.addMobilePriceGuideWeightBand(initial, 0);
  initial = matrix.updateMobilePriceGuideCell(initial, 0, 1, 0, { priceMinKrw: 42000, durationMinutes: 75 });
  const before = matrix.readMobilePriceGuideMatrix(initial);
  const h = harness(true, initial);
  h.nodes(h.cells()[0]).find(node => node.type === "button").props.onClick();
  h.nodes().find(node => typeof node.props?.onStartEdit === "function").props.onStartEdit();
  h.render(); h.deletes()[0].props.onClick(); h.render();
  assert.equal(h.calls, 1); assert.equal(h.changed.length, 1);
  const after = matrix.readMobilePriceGuideMatrix(h.document);
  assert.deepEqual(after.slice(1), before.slice(1));
  assert.deepEqual(after[0].weightBands, before[0].weightBands.slice(1));
  assert.deepEqual(after[0].cells, before[0].cells.slice(1));
  assert.equal(h.document.rows.length, initial.rows.length - before[0].serviceNames.length);
  assert.ok(h.nodes().filter(node => typeof node.props?.onStartEdit === "function").every(node => node.props.editing === false));
  assert.ok(!h.nodes(h.cells()[0]).some(node => node.type === "input"));
});

test("sticky weight cells contain sibling 44px delete controls, no trailing management column", () => {
  const h = harness(false, matrix.addMobilePriceGuideWeightBand(matrix.createMobilePriceGuideSkeleton(), 0));
  for (const cell of h.cells()) {
    assert.match(cell.props.className, /sticky left-0 z-10/); assert.match(cell.props.className, /bg-white/); assert.match(cell.props.className, /w-px whitespace-nowrap/);
    const buttons = h.nodes(cell).filter(node => node.type === "button"); assert.equal(buttons.length, 2);
    const trash = buttons.find(node => "data-mobile-weight-delete" in node.props); assert.match(trash.props.className, /size-11 shrink-0/);
    assert.ok(buttons.every(button => !h.nodes(button.props.children ?? null).some(node => node.type === "button")));
  }
  for (const table of h.nodes().filter(node => node.type === "table")) {
    const header = h.nodes(table).find(node => node.type === "thead");
    assert.equal(h.nodes(header).filter(node => node.type === "th").length, 2);
    assert.equal(table.props.style.minWidth, "284px");
    const sticky = h.nodes(header).find(node => node.type === "th"); assert.match(sticky.props.className, /sticky left-0 z-20/); assert.match(sticky.props.className, /bg-slate-50/);
    for (const row of h.nodes(table).filter(node => node.type === "tbody").flatMap(node => h.nodes(node).filter(child => child.type === "tr"))) assert.equal(h.nodes(row).filter(node => node.type === "td").length, 1);
  }
});

test("last weight row cannot be deleted and helper keeps original document", () => {
  const document = matrix.createMobilePriceGuideSkeleton();
  const h = harness(true, document);
  assert.equal(h.nodes(h.cells()[0]).filter(node => "data-mobile-weight-delete" in (node.props ?? {})).length, 0);
  assert.deepEqual(matrix.removeMobilePriceGuideWeightBand(document, 0, 0), document);
});
