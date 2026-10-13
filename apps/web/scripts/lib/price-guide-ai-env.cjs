const supportedModels = ["gpt-5.6-luna", "gpt-6-luna"];
function classifyPriceGuideAi(values) {
  const enabled = values.OPENAI_PRICE_GUIDE_ENABLED === "true";
  const flag = values.OPENAI_PRICE_GUIDE_ENABLED;
  const redacted = typeof flag === "string" && /sensitive|redacted|encrypted|^@|^vercel:/i.test(flag);
  const featureSetting = flag === "true" ? "enabled" : flag === "false" ? "disabled" : flag ? "invalid" : "unset";
  const trimmedFlag = flag?.replace(/\\[rn]/g, "").trim().replace(/^(['"])(.*)\1$/, "$2").trim();
  const canonicalValue = trimmedFlag === "true" || trimmedFlag === "false" ? trimmedFlag : null;
  const apiKeyPresent = Boolean(values.OPENAI_API_KEY?.trim());
  const model = values.OPENAI_PRICE_GUIDE_MODEL?.trim() || "gpt-5.6-luna";
  const modelSupported = supportedModels.includes(model);
  return { enabled, featureSetting, canonicalValue, apiKeyPresent, model: modelSupported ? model : "unsupported", modelSupported,
    status: redacted ? "REDACTED_VALUE" : featureSetting === "invalid" ? "INVALID_FEATURE_FLAG" : !enabled ? "DISABLED" : !apiKeyPresent ? "API_KEY_MISSING" : !modelSupported ? "UNSUPPORTED_MODEL" : "PASS" };
}
module.exports = { classifyPriceGuideAi };
