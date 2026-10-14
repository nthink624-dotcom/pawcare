import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import { createRequire } from "node:module";
const ts = createRequire(import.meta.url)("typescript");
const source = fs.readFileSync(new URL("../../src/app/api/readyz/route.ts", import.meta.url), "utf8");
async function probe(env) {
  const testModule = { exports: {} };
  const supabase = { from: () => ({ select: () => ({ limit: () => ({ abortSignal: async () => ({ error: null }) }) }) }) };
  const deps = {
    "next/server": { NextResponse: { json: (body, options) => ({ body, status: options.status }) } },
    "@/server/observability": { getReleaseId: () => "fixture", getRequestId: () => "fixture", logOperationalEvent: () => {} },
    "@/lib/supabase/server": { getSupabaseAdmin: () => supabase },
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText,
    { module: testModule, exports: testModule.exports, require: (name) => deps[name], process: { env }, AbortController, setTimeout, clearTimeout });
  return await testModule.exports.GET({});
}
test("runtime readiness exposes only AI configuration booleans, never the secret", async () => {
  const result = await probe({ OPENAI_PRICE_GUIDE_ENABLED: "true", OPENAI_API_KEY: "TOP_SECRET_NEVER_RETURN", OPENAI_PRICE_GUIDE_MODEL: "gpt-6-luna" });
  assert.equal(result.status, 200);
  assert.equal(result.body.configuration.priceGuideAi.enabled, true);
  assert.equal(result.body.configuration.priceGuideAi.apiKeyPresent, true);
  assert.ok(!JSON.stringify(result).includes("TOP_SECRET"));
});
test("malformed feature settings are distinguishable from an intentional disabled feature", async () => {
  const disabled = await probe({ OPENAI_PRICE_GUIDE_ENABLED: "false" });
  const malformed = await probe({ OPENAI_PRICE_GUIDE_ENABLED: "true\n" });
  assert.equal(disabled.body.configuration.priceGuideAi.settingValid, true);
  assert.equal(disabled.body.configuration.priceGuideAi.enabled, false);
  assert.equal(malformed.body.configuration.priceGuideAi.settingValid, false);
});
