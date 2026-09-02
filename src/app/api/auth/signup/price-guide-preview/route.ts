import { NextRequest, NextResponse } from "next/server";

import {
  buildPriceGuideV2Compatibility,
  buildPriceGuideV2FromLegacySignupServices,
  signupPriceGuideReviewCopy,
  signupServicePricesSchema,
  type SignupServicePrice,
} from "@/lib/auth/signup-service-pricing";
import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  createPriceGuideResponsesFixture,
  extractPriceGuideFromImages,
  PriceGuidePhotoImportError,
  PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
} from "@/server/price-guide-photo-import";
import {
  assertSignupSameOrigin,
  claimSignupPriceGuideAnalysis,
  completeSignupPriceGuideAnalysis,
  decryptSignupPriceGuideCache,
  encryptSignupPriceGuideCache,
  getSignupRequestIp,
  normalizeSignupDeviceFingerprint,
  preflightSignupPriceGuideAnalysis,
  purgeSignupPriceGuideAnalysis,
  readSignupPriceGuideSession,
  SIGNUP_PRICE_GUIDE_SESSION_COOKIE,
  SignupPriceGuideGuardError,
  verifySignupPriceGuideAnalysisToken,
} from "@/server/signup-price-guide-analysis-guard";
import { sanitizeSignupPriceGuideImage, SignupPriceGuideImageError } from "@/server/signup-price-guide-image-security";
import {
  parseBoundedSignupPriceGuideMultipart,
  SignupPriceGuideMultipartError,
} from "@/server/signup-price-guide-multipart";
import { priceGuideV2Schema, type PriceGuideV2 } from "@/types/price-guide-photo-import";

export const runtime = "nodejs";

const CACHE_TTL_MS = 5 * 60 * 1000;

type PreviewPayload = {
  document: PriceGuideV2;
  services: SignupServicePrice[];
  reviewCopy: typeof signupPriceGuideReviewCopy;
  summary: string;
  issues: unknown[];
  persisted: false;
  retention: "request_memory_only";
  source: "vision" | "fixture" | "encrypted_ttl_cache";
};

declare global {
  // eslint-disable-next-line no-var
  var __petmanagerSignupPriceGuideFixtureResults: Map<string, string> | undefined;
}

const fixtureResults = globalThis.__petmanagerSignupPriceGuideFixtureResults ?? new Map<string, string>();
globalThis.__petmanagerSignupPriceGuideFixtureResults = fixtureResults;

const fixtureDocument = priceGuideV2Schema.parse({
  schemaVersion: 2,
  source: "fixture",
  overallNote: "Development 비식별 한글 요금표 fixture입니다.",
  rows: [
    { serviceName: "전체 미용", species: "dog", breedNames: ["말티즈", "푸들"], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 5, priceKind: "fixed", priceMinKrw: 80_000, priceMaxKrw: null, durationMinutes: 120, note: "기본 컷" },
    { serviceName: "목욕", species: "dog", breedNames: [], breedGroup: "소형견", sizeClass: "small", minKg: null, maxKg: 5, priceKind: "fixed", priceMinKrw: 35_000, priceMaxKrw: null, durationMinutes: 60, note: "기본 케어" },
    { serviceName: "부분 미용", species: "all", breedNames: [], breedGroup: null, sizeClass: "all", minKg: null, maxKg: null, priceKind: "fixed", priceMinKrw: 30_000, priceMaxKrw: null, durationMinutes: 45, note: "발·얼굴 정리" },
  ],
  surcharges: [],
  aiReview: [],
});

function responseWithRetry(code: string, message: string, status: number, retryAfterSeconds?: number) {
  const response = NextResponse.json({ code, message }, { status });
  if (retryAfterSeconds) response.headers.set("Retry-After", String(retryAfterSeconds));
  return response;
}

async function readCachedPayload(supabase: ReturnType<typeof getSupabaseAdmin>, cacheSourceJti: string) {
  if (!supabase) return null;
  const result = await supabase
    .from("signup_price_guide_analysis_requests")
    .select("cache_ciphertext,cache_expires_at")
    .eq("token_jti", cacheSourceJti)
    .maybeSingle();
  if (result.error || !result.data?.cache_ciphertext || new Date(result.data.cache_expires_at).getTime() <= Date.now()) return null;
  const decoded = decryptSignupPriceGuideCache(result.data.cache_ciphertext, serverEnv.signupPriceGuideCacheSecret);
  if (!decoded || typeof decoded !== "object") return null;
  const source = decoded as { document?: unknown; services?: unknown; summary?: unknown };
  const currentDocument = priceGuideV2Schema.safeParse(source.document);
  if (currentDocument.success) {
    const compatibility = buildPriceGuideV2Compatibility(currentDocument.data);
    return {
      document: currentDocument.data,
      services: compatibility.services,
      reviewCopy: signupPriceGuideReviewCopy,
      summary: typeof source.summary === "string" ? source.summary : `요금 ${currentDocument.data.rows.length}개 행을 읽었습니다.`,
      issues: compatibility.issues,
      persisted: false as const,
      retention: "request_memory_only" as const,
      source: "encrypted_ttl_cache" as const,
    };
  }
  // Five-minute rolling compatibility for encrypted payloads produced by V1.
  const legacyServices = signupServicePricesSchema.safeParse(source.services);
  if (!legacyServices.success) return null;
  const document = buildPriceGuideV2FromLegacySignupServices(legacyServices.data, "legacy");
  return {
    document,
    services: legacyServices.data,
    reviewCopy: signupPriceGuideReviewCopy,
    summary: typeof source.summary === "string" ? source.summary : `기존 요금 ${document.rows.length}개 행을 읽었습니다.`,
    issues: [],
    persisted: false as const,
    retention: "request_memory_only" as const,
    source: "encrypted_ttl_cache" as const,
  };
}

export async function POST(request: NextRequest) {
  let originalBytes: Buffer | null = null;
  let sanitizedBytes: Buffer | null = null;
  let tokenJti: string | null = null;
  let analysisClaimed = false;
  let actualCostMicroUsd = 0;
  const supabase = getSupabaseAdmin();
  const fixtureMode = serverEnv.signupPriceGuideFixtureMode && request.headers.get("x-petmanager-fixture") === "korean-price-guide-v1";
  try {
    assertSignupSameOrigin(request);
    const deviceFingerprint = normalizeSignupDeviceFingerprint(request.headers.get("x-pm-device-fingerprint"));
    const sessionId = readSignupPriceGuideSession(request.cookies.get(SIGNUP_PRICE_GUIDE_SESSION_COOKIE)?.value, serverEnv.signupPriceGuideTokenSecret);
    const authorization = request.headers.get("authorization") ?? "";
    const verifiedToken = verifySignupPriceGuideAnalysisToken({
      token: authorization.startsWith("Bearer ") ? authorization.slice(7) : null,
      sessionId,
      deviceFingerprint,
      ip: getSignupRequestIp(request.headers),
      secret: serverEnv.signupPriceGuideTokenSecret,
    });
    tokenJti = verifiedToken.jti;
    preflightSignupPriceGuideAnalysis({ token: verifiedToken });

    const formData = await parseBoundedSignupPriceGuideMultipart(request);
    const file = formData.get("file");
    if (!(file instanceof File)) return NextResponse.json({ code: "INVALID_FILE", message: "요금표 사진을 선택해 주세요." }, { status: 400 });
    if (file.size > 8 * 1024 * 1024) {
      throw new SignupPriceGuideImageError("IMAGE_TOO_LARGE", "사진은 최대 8MB까지 올릴 수 있습니다.", 413);
    }
    originalBytes = Buffer.from(await file.arrayBuffer());
    const sanitized = await sanitizeSignupPriceGuideImage({ bytes: originalBytes, declaredMimeType: file.type });
    sanitizedBytes = sanitized.buffer;

    const claim = await claimSignupPriceGuideAnalysis({
      supabase,
      token: verifiedToken,
      fileHash: sanitized.fileHash,
      estimatedCostMicroUsd: fixtureMode ? 0 : PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
      dailyCostCapMicroUsd: serverEnv.signupPriceGuideDailyCostCapMicroUsd,
      allowFixtureMemory: fixtureMode,
      meteringSecret: serverEnv.signupPriceGuideMeteringSecret,
    });
    analysisClaimed = true;
    if (claim.cacheSourceJti) {
      const memoryValue = fixtureMode ? fixtureResults.get(claim.cacheSourceJti) : null;
      const cached = memoryValue
        ? decryptSignupPriceGuideCache(memoryValue, serverEnv.signupPriceGuideCacheSecret) as PreviewPayload
        : await readCachedPayload(supabase, claim.cacheSourceJti);
      if (cached) return NextResponse.json({ ...cached, source: "encrypted_ttl_cache" });
    }

    if (!fixtureMode && !serverEnv.openaiApiKey) {
      throw new SignupPriceGuideGuardError("ANALYSIS_GATE_UNAVAILABLE", "사진 AI 판독이 아직 연결되지 않았습니다. 같은 화면에서 직접 입력해 주세요.", 503);
    }
    const result = await extractPriceGuideFromImages(
      [`data:image/jpeg;base64,${sanitizedBytes.toString("base64")}`],
      fixtureMode
        ? {
            timeoutMs: 20_000,
            responsesClient: async () => createPriceGuideResponsesFixture(fixtureDocument),
          }
        : { timeoutMs: 20_000 },
    );
    actualCostMicroUsd = fixtureMode ? 0 : result.providerCostMicroUsd;
    const compatibility = buildPriceGuideV2Compatibility(result.document);
    const payload: PreviewPayload = {
      document: result.document,
      services: compatibility.services,
      reviewCopy: signupPriceGuideReviewCopy,
      summary: result.summary,
      issues: result.issues,
      persisted: false,
      retention: "request_memory_only",
      source: fixtureMode ? "fixture" : "vision",
    };

    const encrypted = encryptSignupPriceGuideCache(payload, serverEnv.signupPriceGuideCacheSecret);
    if (fixtureMode) {
      fixtureResults.set(verifiedToken.jti, encrypted);
    }
    await completeSignupPriceGuideAnalysis({
      supabase,
      tokenJti: verifiedToken.jti,
      actualCostMicroUsd: fixtureMode ? 0 : actualCostMicroUsd || PRICE_GUIDE_VISION_CONSERVATIVE_MAX_COST_MICRO_USD,
      cacheCiphertext: encrypted,
      cacheExpiresAt: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
      allowFixtureMemory: fixtureMode,
    });
    return NextResponse.json(payload);
  } catch (cause) {
    const failureCode = cause instanceof SignupPriceGuideImageError
      ? cause.code
      : cause instanceof SignupPriceGuideMultipartError
        ? cause.code
      : cause instanceof PriceGuidePhotoImportError
        ? cause.code
      : cause instanceof SignupPriceGuideGuardError
        ? cause.code
        : cause instanceof Error && cause.name === "AbortError"
          ? "PROVIDER_TIMEOUT"
          : "PROVIDER_FAILED";
    if (analysisClaimed && tokenJti) {
      try {
        await purgeSignupPriceGuideAnalysis({
          supabase,
          tokenJti,
          reason: failureCode === "PROVIDER_TIMEOUT" || failureCode === "REQUEST_BODY_TIMEOUT" ? "timeout" : "failed",
          failureCode,
          allowFixtureMemory: fixtureMode,
        });
        fixtureResults.delete(tokenJti);
      } catch (purgeCause) {
        if (purgeCause instanceof SignupPriceGuideGuardError) {
          return responseWithRetry(purgeCause.code, purgeCause.message, purgeCause.status, purgeCause.retryAfterSeconds);
        }
        return responseWithRetry("PURGE_FAILED", "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, 15);
      }
    }
    if (cause instanceof SignupPriceGuideMultipartError) return NextResponse.json({ code: cause.code, message: cause.message }, { status: cause.status });
    if (cause instanceof SignupPriceGuideImageError) return NextResponse.json({ code: cause.code, message: cause.message }, { status: cause.status });
    if (cause instanceof PriceGuidePhotoImportError) {
      return NextResponse.json({ code: cause.code, message: cause.message }, { status: cause.status });
    }
    if (cause instanceof SignupPriceGuideGuardError) {
      const publicCode = cause.code === "ANALYSIS_GATE_UNAVAILABLE" && !serverEnv.openaiApiKey ? "VISION_UNAVAILABLE" : cause.code;
      return responseWithRetry(publicCode, cause.message, cause.status, cause.retryAfterSeconds);
    }
    return NextResponse.json({ code: "VISION_FAILED", message: "사진을 판독하지 못했습니다. 같은 화면에서 직접 입력해 주세요." }, { status: 422 });
  } finally {
    originalBytes?.fill(0);
    sanitizedBytes?.fill(0);
  }
}

const purgeReasons = new Set(["confirmed", "cancelled", "retake", "manual", "abandoned"] as const);

export async function DELETE(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  const fixtureMode = serverEnv.signupPriceGuideFixtureMode && request.headers.get("x-petmanager-fixture") === "korean-price-guide-v1";
  try {
    assertSignupSameOrigin(request);
    const deviceFingerprint = normalizeSignupDeviceFingerprint(request.headers.get("x-pm-device-fingerprint"));
    const sessionId = readSignupPriceGuideSession(request.cookies.get(SIGNUP_PRICE_GUIDE_SESSION_COOKIE)?.value, serverEnv.signupPriceGuideTokenSecret);
    const authorization = request.headers.get("authorization") ?? "";
    const verifiedToken = verifySignupPriceGuideAnalysisToken({
      token: authorization.startsWith("Bearer ") ? authorization.slice(7) : null,
      sessionId,
      deviceFingerprint,
      ip: getSignupRequestIp(request.headers),
      secret: serverEnv.signupPriceGuideTokenSecret,
    });
    const reasonValue = new URL(request.url).searchParams.get("reason") ?? "cancelled";
    if (!purgeReasons.has(reasonValue as never)) {
      return NextResponse.json({ code: "PURGE_REASON_INVALID", message: "임시정보 삭제 사유가 올바르지 않습니다." }, { status: 400 });
    }
    await purgeSignupPriceGuideAnalysis({
      supabase,
      tokenJti: verifiedToken.jti,
      reason: reasonValue as "confirmed" | "cancelled" | "retake" | "manual" | "abandoned",
      allowFixtureMemory: fixtureMode,
    });
    fixtureResults.delete(verifiedToken.jti);
    return NextResponse.json({ purged: true, persisted: false });
  } catch (cause) {
    if (cause instanceof SignupPriceGuideGuardError) {
      return responseWithRetry(cause.code, cause.message, cause.status, cause.retryAfterSeconds);
    }
    return responseWithRetry("PURGE_FAILED", "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 503, 15);
  }
}
