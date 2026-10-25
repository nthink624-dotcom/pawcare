import { createHmac, randomBytes } from "node:crypto";

export type ApplicationReference = { code: string; purpose: "campaign_preview_fixture"; expiresAt: string; used: false };

export function createApplicationReferenceCode(now = new Date()): ApplicationReference {
  return {
    code: randomBytes(24).toString("base64url"),
    purpose: "campaign_preview_fixture",
    expiresAt: new Date(now.getTime() + 15 * 60 * 1000).toISOString(),
    used: false,
  };
}

export function createSuppressionKey(rawValue: string, secret: string): string {
  if (secret.length < 32) throw new Error("Suppression HMAC secret must be at least 32 characters.");
  return createHmac("sha256", secret).update(rawValue, "utf8").digest("base64url");
}
