import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { serverEnv } from "@/lib/server-env";
import { nowIso } from "@/lib/utils";

const localChallengeSchema = z.object({
  name: z.string(),
  birthDate: z.string().length(8),
  phoneNumber: z.string(),
  code: z.string().length(6),
  expiresAt: z.number(),
});

const verifiedIdentitySchema = z.object({
  name: z.string(),
  birthDate: z.string().length(8),
  phoneNumber: z.string(),
  verifiedAt: z.string(),
  expiresAt: z.number(),
  source: z.enum(["local", "portone"]),
  identityVerificationId: z.string().optional(),
});

type LocalChallenge = z.infer<typeof localChallengeSchema>;
type VerifiedIdentity = z.infer<typeof verifiedIdentitySchema>;

function sign(value: string) {
  return createHmac("sha256", serverEnv.authFlowSecret).update(value).digest("base64url");
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

export function issueLocalChallengeToken(payload: Omit<LocalChallenge, "expiresAt"> & { expiresInMs?: number }) {
  return issueToken({
    ...payload,
    expiresAt: Date.now() + (payload.expiresInMs ?? 1000 * 60 * 5),
  });
}

export function readLocalChallengeToken(token: string) {
  const parsed = decode(token);
  if (!parsed) return null;
  const result = localChallengeSchema.safeParse(parsed);
  if (!result.success || result.data.expiresAt < Date.now()) return null;
  return result.data;
}

export function issueVerifiedIdentityToken(
  payload: Omit<VerifiedIdentity, "expiresAt" | "verifiedAt"> & { expiresInMs?: number; verifiedAt?: string },
) {
  return issueToken({
    ...payload,
    verifiedAt: payload.verifiedAt ?? nowIso(),
    expiresAt: Date.now() + (payload.expiresInMs ?? 1000 * 60 * 10),
  });
}

export function readVerifiedIdentityToken(token: string) {
  const parsed = decode(token);
  if (!parsed) return null;
  const result = verifiedIdentitySchema.safeParse(parsed);
  if (!result.success || result.data.expiresAt < Date.now()) return null;
  return result.data;
}
