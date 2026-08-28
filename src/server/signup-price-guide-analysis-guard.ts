import { createCipheriv, createDecipheriv, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export const SIGNUP_PRICE_GUIDE_SESSION_COOKIE = "pm_signup_price_guide_session";
const TOKEN_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 60 * 1000;

type TokenPayload = {
  v: 1;
  jti: string;
  sh: string;
  dh: string;
  ih: string;
  iat: number;
  exp: number;
};

export class SignupPriceGuideGuardError extends Error {
  public readonly code:
    | "TOKEN_SECRET_MISSING"
    | "TOKEN_INVALID"
    | "TOKEN_EXPIRED"
    | "SESSION_INVALID"
    | "DEVICE_INVALID"
    | "ORIGIN_REJECTED"
    | "ANALYSIS_GATE_UNAVAILABLE"
    | "RATE_LIMITED"
    | "CIRCUIT_OPEN"
    | "TOKEN_REUSED"
    | "PURGE_FAILED"
    | "NO_ROWS";

  public readonly status: number;
  public readonly retryAfterSeconds?: number;

  constructor(
    code:
      | "TOKEN_SECRET_MISSING"
      | "TOKEN_INVALID"
      | "TOKEN_EXPIRED"
      | "SESSION_INVALID"
      | "DEVICE_INVALID"
      | "ORIGIN_REJECTED"
      | "ANALYSIS_GATE_UNAVAILABLE"
      | "RATE_LIMITED"
      | "CIRCUIT_OPEN"
      | "TOKEN_REUSED"
      | "PURGE_FAILED"
      | "NO_ROWS",
    message: string,
    status: number,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function requireSecret(value: string | undefined, label: string) {
  const secret = value?.trim();
  if (!secret || secret.length < 32) {
    throw new SignupPriceGuideGuardError("TOKEN_SECRET_MISSING", `${label} 서버 설정이 필요합니다.`, 503);
  }
  return secret;
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function hashSubject(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}

function equalSignature(left: string, right: string) {
  const leftBytes = Buffer.from(left);
  const rightBytes = Buffer.from(right);
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

export function createSignupPriceGuideSession(secretInput: string | undefined) {
  const secret = requireSecret(secretInput, "SIGNUP_PRICE_GUIDE_TOKEN_SECRET");
  const sessionId = randomBytes(24).toString("base64url");
  return `${sessionId}.${sign(sessionId, secret)}`;
}

export function readSignupPriceGuideSession(value: string | null | undefined, secretInput: string | undefined) {
  const secret = requireSecret(secretInput, "SIGNUP_PRICE_GUIDE_TOKEN_SECRET");
  const [sessionId, signature, extra] = (value ?? "").split(".");
  if (!sessionId || !signature || extra || !equalSignature(sign(sessionId, secret), signature)) {
    throw new SignupPriceGuideGuardError("SESSION_INVALID", "가입 사진 분석 세션이 만료되었습니다. 다시 시도해 주세요.", 401);
  }
  return sessionId;
}

export function normalizeSignupDeviceFingerprint(value: string | null | undefined) {
  const normalized = (value ?? "").trim();
  if (!/^[a-zA-Z0-9_-]{16,120}$/.test(normalized)) {
    throw new SignupPriceGuideGuardError("DEVICE_INVALID", "가입 기기 확인값이 올바르지 않습니다.", 400);
  }
  return normalized;
}

export function getSignupRequestIp(headers: Headers) {
  return (headers.get("x-forwarded-for")?.split(",")[0] ?? headers.get("x-real-ip") ?? "127.0.0.1").trim().slice(0, 80);
}

export function assertSignupSameOrigin(request: Request) {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    throw new SignupPriceGuideGuardError("ORIGIN_REJECTED", "다른 사이트에서 보낸 요청은 처리할 수 없습니다.", 403);
  }
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    throw new SignupPriceGuideGuardError("ORIGIN_REJECTED", "요청 출처를 확인할 수 없습니다.", 403);
  }
}

export function issueSignupPriceGuideAnalysisToken(input: {
  sessionId: string;
  deviceFingerprint: string;
  ip: string;
  secret: string | undefined;
  nowMs?: number;
}) {
  const secret = requireSecret(input.secret, "SIGNUP_PRICE_GUIDE_TOKEN_SECRET");
  const nowMs = input.nowMs ?? Date.now();
  const payload: TokenPayload = {
    v: 1,
    jti: randomUUID(),
    sh: hashSubject(input.sessionId, secret),
    dh: hashSubject(normalizeSignupDeviceFingerprint(input.deviceFingerprint), secret),
    ih: hashSubject(input.ip, secret),
    iat: nowMs,
    exp: nowMs + TOKEN_TTL_MS,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return { token: `${body}.${sign(body, secret)}`, expiresAt: payload.exp };
}

export function verifySignupPriceGuideAnalysisToken(input: {
  token: string | null | undefined;
  sessionId: string;
  deviceFingerprint: string;
  ip: string;
  secret: string | undefined;
  nowMs?: number;
}) {
  const secret = requireSecret(input.secret, "SIGNUP_PRICE_GUIDE_TOKEN_SECRET");
  const [body, signature, extra] = (input.token ?? "").split(".");
  if (!body || !signature || extra || !equalSignature(sign(body, secret), signature)) {
    throw new SignupPriceGuideGuardError("TOKEN_INVALID", "사진 분석 권한을 다시 받아 주세요.", 401);
  }
  let payload: TokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as TokenPayload;
  } catch {
    throw new SignupPriceGuideGuardError("TOKEN_INVALID", "사진 분석 권한을 다시 받아 주세요.", 401);
  }
  if (payload.v !== 1 || !/^[0-9a-f-]{36}$/i.test(payload.jti)) {
    throw new SignupPriceGuideGuardError("TOKEN_INVALID", "사진 분석 권한을 다시 받아 주세요.", 401);
  }
  if (payload.exp < (input.nowMs ?? Date.now())) {
    throw new SignupPriceGuideGuardError("TOKEN_EXPIRED", "사진 분석 권한이 만료되었습니다. 다시 시도해 주세요.", 401);
  }
  if (
    payload.sh !== hashSubject(input.sessionId, secret) ||
    payload.dh !== hashSubject(normalizeSignupDeviceFingerprint(input.deviceFingerprint), secret) ||
    payload.ih !== hashSubject(input.ip, secret)
  ) {
    throw new SignupPriceGuideGuardError("TOKEN_INVALID", "사진 분석 요청 정보가 일치하지 않습니다.", 401);
  }
  return payload;
}

export function getSignupPriceGuideSessionMaxAgeSeconds() {
  return Math.floor(SESSION_TTL_MS / 1000);
}

type AnalysisClaim = {
  allowed: boolean;
  code: string;
  retryAfterSeconds: number;
  cacheSourceJti: string | null;
};

export type SignupPriceGuideMeteringKeys = {
  rotationId: string;
  ipBucketHmac: string;
  sessionBucketHmac: string;
  deviceBucketHmac: string;
  providerBucketHmac: string;
  circuitBucketHmac: string;
};

type SupabaseLike = {
  rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
};

declare global {
  // eslint-disable-next-line no-var
  var __petmanagerSignupPriceGuideClaims: Map<string, {
    createdAt: number;
    status: "processing" | "completed" | "failed" | "tombstoned";
    fileHash: string;
    estimatedCostMicroUsd: number;
    providerMeterKey: string;
  }> | undefined;
  // eslint-disable-next-line no-var
  var __petmanagerSignupPriceGuideMeters: Map<string, {
    requestCount: number;
    reservedCostMicroUsd: number;
    actualCostMicroUsd: number;
    expiresAt: number;
  }> | undefined;
}

const memoryClaims = globalThis.__petmanagerSignupPriceGuideClaims ?? new Map();
globalThis.__petmanagerSignupPriceGuideClaims = memoryClaims;
const memoryMeters = globalThis.__petmanagerSignupPriceGuideMeters ?? new Map();
globalThis.__petmanagerSignupPriceGuideMeters = memoryMeters;

function utcPeriodStart(nowMs: number, durationMs: number) {
  return Math.floor(nowMs / durationMs) * durationMs;
}

function fixtureMeterKey(kind: string, subjectHash: string, startMs: number) {
  return `${kind}:${startMs}:${subjectHash}`;
}

function readFixtureMeter(key: string, expiresAt: number) {
  const current = memoryMeters.get(key) ?? { requestCount: 0, reservedCostMicroUsd: 0, actualCostMicroUsd: 0, expiresAt };
  memoryMeters.set(key, current);
  return current;
}

function claimInFixtureMemory(input: {
  token: TokenPayload;
  fileHash: string;
  estimatedCostMicroUsd: number;
  dailyCostCapMicroUsd: number;
  nowMs: number;
}): AnalysisClaim {
  const tenMinutes = 10 * 60 * 1000;
  const day = 24 * 60 * 60 * 1000;
  const ipStart = utcPeriodStart(input.nowMs, tenMinutes);
  const dayStart = utcPeriodStart(input.nowMs, day);
  for (const [key, meter] of memoryMeters) if (meter.expiresAt <= input.nowMs) memoryMeters.delete(key);
  for (const [jti, value] of memoryClaims) {
    if (input.nowMs - value.createdAt > SESSION_TTL_MS) memoryClaims.delete(jti);
  }
  if (memoryClaims.has(input.token.jti)) return { allowed: false, code: "TOKEN_REUSED", retryAfterSeconds: 0, cacheSourceJti: null };

  const ipKey = fixtureMeterKey("ip_10m", input.token.ih, ipStart);
  const sessionKey = fixtureMeterKey("session_day", input.token.sh, dayStart);
  const deviceKey = fixtureMeterKey("device_day", input.token.dh, dayStart);
  const providerKey = fixtureMeterKey("provider_day", "fixture-provider", dayStart);
  const ipMeter = readFixtureMeter(ipKey, ipStart + tenMinutes + 60 * 60 * 1000);
  const sessionMeter = readFixtureMeter(sessionKey, dayStart + day + 60 * 60 * 1000);
  const deviceMeter = readFixtureMeter(deviceKey, dayStart + day + 60 * 60 * 1000);
  const providerMeter = readFixtureMeter(providerKey, dayStart + day + 35 * day);
  if (ipMeter.requestCount >= 10 || sessionMeter.requestCount >= 6 || deviceMeter.requestCount >= 8) {
    return { allowed: false, code: "RATE_LIMITED", retryAfterSeconds: 600, cacheSourceJti: null };
  }

  const cached = [...memoryClaims.entries()].find(([, value]) => value.fileHash === input.fileHash && value.status === "completed" && input.nowMs - value.createdAt < 5 * 60 * 1000);
  const reservedCost = cached ? 0 : input.estimatedCostMicroUsd;
  if (providerMeter.reservedCostMicroUsd + providerMeter.actualCostMicroUsd + reservedCost > input.dailyCostCapMicroUsd) {
    return { allowed: false, code: "RATE_LIMITED", retryAfterSeconds: 600, cacheSourceJti: null };
  }

  ipMeter.requestCount += 1;
  sessionMeter.requestCount += 1;
  deviceMeter.requestCount += 1;
  providerMeter.requestCount += 1;
  providerMeter.reservedCostMicroUsd += reservedCost;
  memoryClaims.set(input.token.jti, {
    createdAt: input.nowMs,
    status: cached ? "completed" : "processing",
    fileHash: input.fileHash,
    estimatedCostMicroUsd: reservedCost,
    providerMeterKey: providerKey,
  });
  return { allowed: true, code: cached ? "CACHE_HIT" : "ALLOWED", retryAfterSeconds: 0, cacheSourceJti: cached?.[0] ?? null };
}

export function deriveSignupPriceGuideMeteringKeys(input: {
  token: Pick<TokenPayload, "ih" | "sh" | "dh">;
  secret: string | undefined;
  nowMs?: number;
}): SignupPriceGuideMeteringKeys {
  const secret = requireSecret(input.secret, "SIGNUP_PRICE_GUIDE_METERING_SECRET");
  const now = new Date(input.nowMs ?? Date.now());
  const rotationId = now.toISOString().slice(0, 7);
  const dayStart = `${now.toISOString().slice(0, 10)}T00:00:00.000Z`;
  const ipStart = new Date(utcPeriodStart(now.getTime(), 10 * 60 * 1000)).toISOString();
  const circuitStart = new Date(utcPeriodStart(now.getTime(), 5 * 60 * 1000)).toISOString();
  const rotationKey = createHmac("sha256", secret).update(`signup-price-meter-rotation:${rotationId}`).digest();
  const bucket = (kind: string, period: string, subject: string) =>
    createHmac("sha256", rotationKey).update(`${kind}\0${period}\0${subject}`).digest("hex");
  return {
    rotationId,
    ipBucketHmac: bucket("ip_10m", ipStart, input.token.ih),
    sessionBucketHmac: bucket("session_day", dayStart, input.token.sh),
    deviceBucketHmac: bucket("device_day", dayStart, input.token.dh),
    providerBucketHmac: bucket("provider_day", dayStart, "vision-provider"),
    circuitBucketHmac: bucket("provider_circuit_5m", circuitStart, "vision-provider"),
  };
}

function assertAllowedClaim(claim: AnalysisClaim) {
  if (claim.allowed) return claim;
  if (claim.code === "TOKEN_REUSED") {
    throw new SignupPriceGuideGuardError("TOKEN_REUSED", "이미 사용한 사진 분석 권한입니다. 다시 시도해 주세요.", 409);
  }
  if (claim.code === "CIRCUIT_OPEN") {
    throw new SignupPriceGuideGuardError("CIRCUIT_OPEN", "사진 분석을 잠시 쉬고 있습니다. 직접 입력하거나 잠시 후 다시 시도해 주세요.", 503, claim.retryAfterSeconds);
  }
  throw new SignupPriceGuideGuardError("RATE_LIMITED", "사진 분석 요청이 많습니다. 잠시 후 다시 시도해 주세요.", 429, claim.retryAfterSeconds || 60);
}

export function markFixtureSignupPriceGuideAnalysisCompleted(tokenJti: string, actualCostMicroUsd = 0) {
  const current = memoryClaims.get(tokenJti);
  if (!current || current.status !== "processing") return;
  const providerMeter = memoryMeters.get(current.providerMeterKey);
  if (providerMeter) {
    providerMeter.reservedCostMicroUsd = Math.max(0, providerMeter.reservedCostMicroUsd - current.estimatedCostMicroUsd);
    providerMeter.actualCostMicroUsd += actualCostMicroUsd;
  }
  memoryClaims.set(tokenJti, { ...current, status: "completed" });
}

export function purgeFixtureSignupPriceGuideAnalysis(tokenJti: string) {
  const current = memoryClaims.get(tokenJti);
  if (!current) return;
  if (current.status === "processing") {
    const providerMeter = memoryMeters.get(current.providerMeterKey);
    if (providerMeter) providerMeter.reservedCostMicroUsd = Math.max(0, providerMeter.reservedCostMicroUsd - current.estimatedCostMicroUsd);
  }
  memoryClaims.set(tokenJti, { ...current, status: "tombstoned", fileHash: "", estimatedCostMicroUsd: 0, providerMeterKey: "" });
}

export function resetFixtureSignupPriceGuideSecurityState() {
  memoryClaims.clear();
  memoryMeters.clear();
}

export async function purgeSignupPriceGuideAnalysis(input: {
  supabase: SupabaseLike | null;
  tokenJti: string;
  reason: "confirmed" | "cancelled" | "retake" | "manual" | "failed" | "timeout" | "abandoned";
  failureCode?: string | null;
  allowFixtureMemory: boolean;
}) {
  if (input.allowFixtureMemory) {
    purgeFixtureSignupPriceGuideAnalysis(input.tokenJti);
    return;
  }
  if (!input.supabase) {
    throw new SignupPriceGuideGuardError("PURGE_FAILED", "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, 15);
  }
  const result = await input.supabase.rpc("purge_signup_price_guide_analysis_v2", {
    p_token_jti: input.tokenJti,
    p_reason: input.reason,
    p_failure_code: input.failureCode ?? null,
  });
  if (result.error || result.data !== true) {
    throw new SignupPriceGuideGuardError("PURGE_FAILED", "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, 15);
  }
}

export async function claimSignupPriceGuideAnalysis(input: {
  supabase: SupabaseLike | null;
  token: TokenPayload;
  fileHash: string;
  estimatedCostMicroUsd: number;
  dailyCostCapMicroUsd: number;
  allowFixtureMemory: boolean;
  meteringSecret?: string;
  nowMs?: number;
}) {
  if (input.allowFixtureMemory) {
    return assertAllowedClaim(claimInFixtureMemory({
      token: input.token,
      fileHash: input.fileHash,
      estimatedCostMicroUsd: input.estimatedCostMicroUsd,
      dailyCostCapMicroUsd: input.dailyCostCapMicroUsd,
      nowMs: input.nowMs ?? Date.now(),
    }));
  }
  if (!input.supabase) {
    throw new SignupPriceGuideGuardError("ANALYSIS_GATE_UNAVAILABLE", "사진 분석 보안 게이트가 연결되지 않았습니다.", 503);
  }
  const metering = deriveSignupPriceGuideMeteringKeys({ token: input.token, secret: input.meteringSecret, nowMs: input.nowMs });
  const result = await input.supabase.rpc("claim_signup_price_guide_analysis_v2", {
    p_token_jti: input.token.jti,
    p_ip_hash: input.token.ih,
    p_session_hash: input.token.sh,
    p_device_hash: input.token.dh,
    p_file_hash: input.fileHash,
    p_rotation_id: metering.rotationId,
    p_ip_bucket_hmac: metering.ipBucketHmac,
    p_session_bucket_hmac: metering.sessionBucketHmac,
    p_device_bucket_hmac: metering.deviceBucketHmac,
    p_provider_bucket_hmac: metering.providerBucketHmac,
    p_circuit_bucket_hmac: metering.circuitBucketHmac,
    p_estimated_cost_microusd: input.estimatedCostMicroUsd,
    p_daily_cost_cap_microusd: input.dailyCostCapMicroUsd,
  });
  if (result.error) {
    throw new SignupPriceGuideGuardError("ANALYSIS_GATE_UNAVAILABLE", "사진 분석 보안 게이트를 확인하지 못했습니다.", 503);
  }
  const value = (Array.isArray(result.data) ? result.data[0] : result.data) as Record<string, unknown> | null;
  const claim: AnalysisClaim = {
    allowed: value?.allowed === true,
    code: typeof value?.code === "string" ? value.code : "ANALYSIS_GATE_UNAVAILABLE",
    retryAfterSeconds: typeof value?.retry_after_seconds === "number" ? value.retry_after_seconds : 0,
    cacheSourceJti: typeof value?.cache_source_jti === "string" ? value.cache_source_jti : null,
  };
  return assertAllowedClaim(claim);
}

export async function completeSignupPriceGuideAnalysis(input: {
  supabase: SupabaseLike | null;
  tokenJti: string;
  actualCostMicroUsd: number;
  cacheCiphertext: string;
  cacheExpiresAt: string;
  allowFixtureMemory: boolean;
}) {
  if (input.allowFixtureMemory) {
    markFixtureSignupPriceGuideAnalysisCompleted(input.tokenJti, input.actualCostMicroUsd);
    return;
  }
  if (!input.supabase) {
    throw new SignupPriceGuideGuardError("ANALYSIS_GATE_UNAVAILABLE", "사진 분석 보안 계량을 완료하지 못했습니다.", 503, 15);
  }
  const result = await input.supabase.rpc("complete_signup_price_guide_analysis_v2", {
    p_token_jti: input.tokenJti,
    p_actual_cost_microusd: input.actualCostMicroUsd,
    p_cache_ciphertext: input.cacheCiphertext,
    p_cache_expires_at: input.cacheExpiresAt,
  });
  if (result.error || result.data !== true) {
    throw new SignupPriceGuideGuardError("ANALYSIS_GATE_UNAVAILABLE", "사진 분석 보안 계량을 완료하지 못했습니다.", 503, 15);
  }
}

function deriveEncryptionKey(secretInput: string | undefined) {
  const secret = requireSecret(secretInput, "SIGNUP_PRICE_GUIDE_CACHE_SECRET");
  return createHmac("sha256", secret).update("signup-price-guide-cache-v1").digest();
}

export function encryptSignupPriceGuideCache(value: unknown, secret: string | undefined) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", deriveEncryptionKey(secret), iv);
  const plaintext = Buffer.from(JSON.stringify(value));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  plaintext.fill(0);
  return `${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSignupPriceGuideCache(value: string, secret: string | undefined) {
  const [ivValue, tagValue, ciphertextValue, extra] = value.split(".");
  if (!ivValue || !tagValue || !ciphertextValue || extra) throw new Error("CACHE_INVALID");
  const decipher = createDecipheriv("aes-256-gcm", deriveEncryptionKey(secret), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextValue, "base64url")), decipher.final()]);
  try {
    return JSON.parse(plaintext.toString("utf8")) as unknown;
  } finally {
    plaintext.fill(0);
  }
}
