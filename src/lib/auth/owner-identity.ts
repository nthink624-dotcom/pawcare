import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { requireServerSecret, serverEnv } from "@/lib/server-env";

export const identityVerificationPurposeSchema = z.enum(["signup", "reset-password", "find-login-id"]);

export type IdentityVerificationPurpose = z.infer<typeof identityVerificationPurposeSchema>;

export const verifiedIdentityTokenSchema = z.object({
  verificationId: z.string().uuid(),
  tokenId: z.string().uuid(),
  purpose: identityVerificationPurposeSchema,
  source: z.enum(["local", "portone"]),
  expiresAt: z.number(),
});

export type VerifiedIdentityToken = z.infer<typeof verifiedIdentityTokenSchema>;

function sign(value: string) {
  return createHmac("sha256", requireServerSecret(serverEnv.authFlowSecret, "AUTH_FLOW_SECRET"))
    .update(value)
    .digest("base64url");
}

function encode(payload: object) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decode(token: string) {
  const [payloadEncoded, signature] = token.split(".");
  if (!payloadEncoded || !signature) {
    return null;
  }

  const expected = sign(payloadEncoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }

  const raw = Buffer.from(payloadEncoded, "base64url").toString("utf8");
  return JSON.parse(raw) as unknown;
}

function issueToken(payload: object) {
  const encoded = encode(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function hashIdentityVerificationCode(code: string) {
  return createHmac("sha256", requireServerSecret(serverEnv.authFlowSecret, "AUTH_FLOW_SECRET"))
    .update(code)
    .digest("hex");
}

export function hashIdentityStableValue(value: string) {
  return createHmac("sha256", requireServerSecret(serverEnv.authFlowSecret, "AUTH_FLOW_SECRET"))
    .update(`identity:${value.trim()}`)
    .digest("hex");
}

export function createIdentityVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function issueVerifiedIdentityToken(
  payload: Omit<VerifiedIdentityToken, "tokenId" | "expiresAt"> & { tokenId?: string; expiresInMs?: number },
) {
  return issueToken({
    ...payload,
    tokenId: payload.tokenId ?? randomUUID(),
    expiresAt: Date.now() + (payload.expiresInMs ?? 1000 * 60 * 10),
  });
}

export function readVerifiedIdentityToken(token: string) {
  const parsed = decode(token);
  if (!parsed) return null;
  const result = verifiedIdentityTokenSchema.safeParse(parsed);
  if (!result.success || result.data.expiresAt < Date.now()) return null;
  return result.data;
}
