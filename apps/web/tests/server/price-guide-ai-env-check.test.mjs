import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
const { classifyPriceGuideAi } = createRequire(import.meta.url)("../../scripts/lib/price-guide-ai-env.cjs");
test("production AI check distinguishes disabled, missing credential and unsupported model", () => {
  assert.equal(classifyPriceGuideAi({}).status, "DISABLED");
  assert.equal(classifyPriceGuideAi({ OPENAI_PRICE_GUIDE_ENABLED: "true" }).status, "API_KEY_MISSING");
  assert.equal(classifyPriceGuideAi({ OPENAI_PRICE_GUIDE_ENABLED: "true\n" }).status, "INVALID_FEATURE_FLAG");
  assert.equal(classifyPriceGuideAi({ OPENAI_PRICE_GUIDE_ENABLED: "[sensitive]" }).status, "REDACTED_VALUE");
  assert.equal(classifyPriceGuideAi({ OPENAI_PRICE_GUIDE_ENABLED: "true", OPENAI_API_KEY: "TOP_SECRET", OPENAI_PRICE_GUIDE_MODEL: "unknown" }).status, "UNSUPPORTED_MODEL");
});
test("supported configuration passes without exposing the credential", () => {
  const result = classifyPriceGuideAi({ OPENAI_PRICE_GUIDE_ENABLED: "true", OPENAI_API_KEY: "TOP_SECRET", OPENAI_PRICE_GUIDE_MODEL: "gpt-6-luna" });
  assert.equal(result.status, "PASS");
  assert.ok(!JSON.stringify(result).includes("TOP_SECRET"));
});
