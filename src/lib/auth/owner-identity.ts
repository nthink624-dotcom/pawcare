import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { normalizeOwnerPhoneNumber } from "@/lib/auth/owner-credentials";
import { requireServerSecret, serverEnv } from "@/lib/server-env";

export const identityVerificationPurposeSchema = z.enum(["signup", "reset-password", "find-email"]);

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

type OwnerTrialIdentityKey = { identityKey: string; keyVersion: string };

export function buildOwnerTrialPhoneIdentityKeys(value: string): {
  currentVersion: string;
  keys: OwnerTrialIdentityKey[];
} {
  const canonicalPhone = normalizeOwnerPhoneNumber(value);
  if (!/^01\d{8,9}$/.test(canonicalPhone)) {
    throw new Error("본인확인 휴대폰 번호 형식이 올바르지 않습니다.");
  }

  const currentVersion = serverEnv.ownerTrialIdentityCurrentVersion;
  if (!/^v\d+$/.test(currentVersion)) {
    throw new Error("무료 체험 identity key version 설정을 확인해 주세요.");
  }

  const configuredSecrets = [
    ["v1", serverEnv.ownerTrialIdentityHmacSecretV1],
    ["v2", serverEnv.ownerTrialIdentityHmacSecretV2],
  ] as const;
  const keys = configuredSecrets.flatMap(([keyVersion, secret]) =>
    secret
      ? [{
          keyVersion,
          identityKey: createHmac("sha256", secret)
            .update(`owner-trial-phone:${keyVersion}\0${canonicalPhone}`)
            .digest("hex"),
        }]
      : [],
  );

  if (!keys.some((item) => item.keyVersion === currentVersion)) {
    requireServerSecret(undefined, `OWNER_TRIAL_IDENTITY_HMAC_SECRET_${currentVersion.toUpperCase()}`);
  }

  return { currentVersion, keys };
}

export function hashOwnerTrialPhoneIdentity(value: string) {
  const identity = buildOwnerTrialPhoneIdentityKeys(value);
  return identity.keys.find((item) => item.keyVersion === identity.currentVersion)!.identityKey;
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
