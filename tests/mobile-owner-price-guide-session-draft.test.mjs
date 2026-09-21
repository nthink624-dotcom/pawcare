import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/price-photo/owner-price-guide-session-draft.ts", import.meta.url), "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;

function load() {
  const values = new Map();
  const exports = {};
  vm.runInNewContext(code, { exports, window: { sessionStorage: {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  } } });
  return { api: exports, values };
}

const draft = { rows: [], document: { schemaVersion: 2, rows: [] }, serviceId: null, resumeMode: "manual" };

test("mobile price-guide work restores per owner and shop with its editing screen", () => {
  const { api } = load();
  const key = api.ownerPriceGuideSessionKey({ shop: { owner_user_id: "owner-a", id: "shop-a" } });
  api.writeOwnerPriceGuideSessionDraft(key, draft);
  assert.equal(JSON.stringify(api.readOwnerPriceGuideSessionDraft(key)), JSON.stringify(draft));
  assert.equal(api.readOwnerPriceGuideSessionDraft(api.ownerPriceGuideSessionKey({ shop: { owner_user_id: "owner-b", id: "shop-a" } })), null);
  api.writeOwnerPriceGuideSessionDraft(key, null);
  assert.equal(api.readOwnerPriceGuideSessionDraft(key), null);
});

test("malformed mobile price-guide work is never restored", () => {
  const { api, values } = load();
  values.set("bad", JSON.stringify({ rows: [], document: {}, serviceId: null, resumeMode: "choose" }));
  assert.equal(api.readOwnerPriceGuideSessionDraft("bad"), null);
});
