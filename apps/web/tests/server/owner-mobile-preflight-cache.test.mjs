import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
const source = readFileSync(new URL("../../src/server/owner-mobile-cors.ts", import.meta.url), "utf8");
const module = { exports: {} };
const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
Function("require", "module", "exports", output)(require, module, module.exports);
const { ownerMobileCorsPreflight, ownerMobileCorsJson } = module.exports;

function request(origin, method = "GET") {
  return new NextRequest("https://www.petmanager.co.kr/api/bootstrap", {
    method: "OPTIONS",
    headers: { origin, "access-control-request-method": method },
  });
}

test("only an existing allowed origin receives a ten-minute preflight lifetime", () => {
  for (const origin of ["https://app.petmanager.co.kr", "capacitor://localhost", "http://127.0.0.1:3100"]) {
    const response = ownerMobileCorsPreflight(request(origin));
    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.equal(response.headers.get("access-control-max-age"), "600");
    assert.equal(response.headers.get("vary"), "Origin");
  }
});

test("unknown origins receive no CORS permission or cache lifetime", () => {
  const response = ownerMobileCorsPreflight(request("https://untrusted.example"));
  assert.equal(response.headers.get("access-control-allow-origin"), null);
  assert.equal(response.headers.get("access-control-max-age"), null);
});

test("disallowed methods still fail and their result is not cached", () => {
  const response = ownerMobileCorsPreflight(request("https://app.petmanager.co.kr", "DELETE"));
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("access-control-max-age"), null);
  assert.equal(response.headers.get("allow"), "GET, OPTIONS");
});

test("preflight caching adds no cache lifetime to customer-data responses", () => {
  const authenticated = new NextRequest("https://www.petmanager.co.kr/api/bootstrap", {
    headers: { origin: "https://app.petmanager.co.kr", authorization: "Bearer fixture-not-a-credential" },
  });
  const response = ownerMobileCorsJson(authenticated, { fixture: true });
  assert.equal(response.headers.get("access-control-max-age"), null);
  assert.equal(response.headers.get("access-control-allow-credentials"), null);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
});

test("public responses retain their existing cache policy", () => {
  const response = ownerMobileCorsJson(request("https://app.petmanager.co.kr"), { fixture: true }, {
    headers: { "Cache-Control": "public, max-age=120" },
  });
  assert.equal(response.headers.get("cache-control"), "public, max-age=120");
});
