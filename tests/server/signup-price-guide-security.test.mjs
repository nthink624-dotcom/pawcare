import assert from "node:assert/strict";
import test from "node:test";

import sharp from "sharp";

import {
  claimSignupPriceGuideAnalysis,
  completeSignupPriceGuideAnalysis,
  createSignupPriceGuideSession,
  deriveSignupPriceGuideMeteringKeys,
  decryptSignupPriceGuideCache,
  encryptSignupPriceGuideCache,
  issueSignupPriceGuideAnalysisToken,
  markFixtureSignupPriceGuideAnalysisCompleted,
  purgeFixtureSignupPriceGuideAnalysis,
  purgeSignupPriceGuideAnalysis,
  readSignupPriceGuideSession,
  resetFixtureSignupPriceGuideSecurityState,
  SignupPriceGuideGuardError,
  verifySignupPriceGuideAnalysisToken,
} from "../../src/server/signup-price-guide-analysis-guard.ts";
import {
  sanitizeSignupPriceGuideImage,
  SignupPriceGuideImageError,
} from "../../src/server/signup-price-guide-image-security.ts";
import {
  readBoundedSignupPriceGuideBody,
  SIGNUP_PRICE_GUIDE_MULTIPART_MAX_BYTES,
  SIGNUP_PRICE_GUIDE_MULTIPART_OVERHEAD_BYTES,
  SignupPriceGuideMultipartError,
} from "../../src/server/signup-price-guide-multipart.ts";

const secret = "test-secret-value-that-is-longer-than-thirty-two-characters";

async function png(width = 640, height = 480) {
  return sharp({ create: { width, height, channels: 3, background: "#f3e7de" } }).png().toBuffer();
}

test("정상 PNG는 실제 decoder를 거쳐 EXIF 없는 JPEG로 재인코딩된다", async () => {
  const source = await png();
  const result = await sanitizeSignupPriceGuideImage({ bytes: source, declaredMimeType: "image/png" });
  const metadata = await sharp(result.buffer).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.exif, undefined);
  assert.equal(result.exifRemoved, true);
  assert.match(result.fileHash, /^[0-9a-f]{64}$/);
  result.buffer.fill(0);
  source.fill(0);
});

test("MIME 위장, truncated, polyglot 파일은 차단된다", async () => {
  const source = await png();
  await assert.rejects(
    sanitizeSignupPriceGuideImage({ bytes: source, declaredMimeType: "image/jpeg" }),
    (error) => error instanceof SignupPriceGuideImageError && error.code === "IMAGE_MIME_MISMATCH",
  );
  await assert.rejects(
    sanitizeSignupPriceGuideImage({ bytes: source.subarray(0, source.length - 10), declaredMimeType: "image/png" }),
    (error) => error instanceof SignupPriceGuideImageError && error.code === "IMAGE_TRUNCATED_OR_POLYGLOT",
  );
  await assert.rejects(
    sanitizeSignupPriceGuideImage({ bytes: Buffer.concat([source, Buffer.from("<script>")]), declaredMimeType: "image/png" }),
    (error) => error instanceof SignupPriceGuideImageError && error.code === "IMAGE_TRUNCATED_OR_POLYGLOT",
  );
  source.fill(0);
});

test("허용 폭을 넘는 초대형 fixture는 decoder 이후 차단된다", async () => {
  const source = await png(8_001, 2);
  await assert.rejects(
    sanitizeSignupPriceGuideImage({ bytes: source, declaredMimeType: "image/png" }),
    (error) => error instanceof SignupPriceGuideImageError && error.code === "IMAGE_DIMENSIONS_EXCEEDED",
  );
  source.fill(0);
});

test("일회성 분석 토큰은 session, IP, device 조합에 묶인다", () => {
  const cookie = createSignupPriceGuideSession(secret);
  const sessionId = readSignupPriceGuideSession(cookie, secret);
  const issued = issueSignupPriceGuideAnalysisToken({
    sessionId,
    deviceFingerprint: "device_fixture_1234567890",
    ip: "127.0.0.1",
    secret,
    nowMs: 1_000,
  });
  const token = verifySignupPriceGuideAnalysisToken({
    token: issued.token,
    sessionId,
    deviceFingerprint: "device_fixture_1234567890",
    ip: "127.0.0.1",
    secret,
    nowMs: 1_100,
  });
  assert.match(token.jti, /^[0-9a-f-]{36}$/i);
  assert.throws(
    () => verifySignupPriceGuideAnalysisToken({ token: issued.token, sessionId, deviceFingerprint: "different_device_123456", ip: "127.0.0.1", secret, nowMs: 1_100 }),
    (error) => error instanceof SignupPriceGuideGuardError && error.code === "TOKEN_INVALID",
  );
});

test("fixture gate도 같은 token jti 재사용을 거절한다", async () => {
  resetFixtureSignupPriceGuideSecurityState();
  const cookie = createSignupPriceGuideSession(secret);
  const sessionId = readSignupPriceGuideSession(cookie, secret);
  const issued = issueSignupPriceGuideAnalysisToken({ sessionId, deviceFingerprint: "fixture_device_12345678", ip: "127.0.0.1", secret });
  const token = verifySignupPriceGuideAnalysisToken({ token: issued.token, sessionId, deviceFingerprint: "fixture_device_12345678", ip: "127.0.0.1", secret });
  const first = await claimSignupPriceGuideAnalysis({ supabase: null, token, fileHash: "a".repeat(64), estimatedCostMicroUsd: 0, dailyCostCapMicroUsd: 1000, allowFixtureMemory: true });
  assert.equal(first.allowed, true);
  await assert.rejects(
    claimSignupPriceGuideAnalysis({ supabase: null, token, fileHash: "a".repeat(64), estimatedCostMicroUsd: 0, dailyCostCapMicroUsd: 1000, allowFixtureMemory: true }),
    (error) => error instanceof SignupPriceGuideGuardError && error.code === "TOKEN_REUSED",
  );
});

test("fixture purge 뒤에도 같은 일회성 token은 재사용할 수 없다", async () => {
  resetFixtureSignupPriceGuideSecurityState();
  const cookie = createSignupPriceGuideSession(secret);
  const sessionId = readSignupPriceGuideSession(cookie, secret);
  const issued = issueSignupPriceGuideAnalysisToken({ sessionId, deviceFingerprint: "purge_device_1234567890", ip: "127.0.0.1", secret });
  const token = verifySignupPriceGuideAnalysisToken({ token: issued.token, sessionId, deviceFingerprint: "purge_device_1234567890", ip: "127.0.0.1", secret });
  await claimSignupPriceGuideAnalysis({ supabase: null, token, fileHash: "b".repeat(64), estimatedCostMicroUsd: 0, dailyCostCapMicroUsd: 1000, allowFixtureMemory: true });
  purgeFixtureSignupPriceGuideAnalysis(token.jti);
  await assert.rejects(
    claimSignupPriceGuideAnalysis({ supabase: null, token, fileHash: "b".repeat(64), estimatedCostMicroUsd: 0, dailyCostCapMicroUsd: 1000, allowFixtureMemory: true }),
    (error) => error instanceof SignupPriceGuideGuardError && error.code === "TOKEN_REUSED",
  );
});

test("DB purge는 tombstone RPC 실패를 성공처럼 처리하지 않는다", async () => {
  const calls = [];
  const successSupabase = {
    rpc: async (name, args) => {
      calls.push({ name, args });
      return { data: true, error: null };
    },
  };
  await purgeSignupPriceGuideAnalysis({
    supabase: successSupabase,
    tokenJti: "11111111-1111-4111-8111-111111111111",
    reason: "confirmed",
    allowFixtureMemory: false,
  });
  assert.equal(calls[0].name, "purge_signup_price_guide_analysis_v2");
  assert.equal(calls[0].args.p_reason, "confirmed");

  await assert.rejects(
    purgeSignupPriceGuideAnalysis({
      supabase: { rpc: async () => ({ data: false, error: { message: "fixture failure" } }) },
      tokenJti: "22222222-2222-4222-8222-222222222222",
      reason: "cancelled",
      allowFixtureMemory: false,
    }),
    (error) => error instanceof SignupPriceGuideGuardError && error.code === "PURGE_FAILED" && error.status === 503,
  );
});

test("회전 HMAC meter key는 원문을 포함하지 않고 월 경계에서 교체된다", () => {
  const token = { ih: "i".repeat(64), sh: "s".repeat(64), dh: "d".repeat(64) };
  const january = deriveSignupPriceGuideMeteringKeys({ token, secret, nowMs: Date.parse("2026-01-31T23:59:00Z") });
  const february = deriveSignupPriceGuideMeteringKeys({ token, secret, nowMs: Date.parse("2026-02-01T00:01:00Z") });
  for (const value of Object.values(january).slice(1)) assert.match(value, /^[0-9a-f]{64}$/);
  assert.equal(january.rotationId, "2026-01");
  assert.equal(february.rotationId, "2026-02");
  assert.notEqual(january.sessionBucketHmac, february.sessionBucketHmac);
  assert.equal(JSON.stringify(january).includes(token.ih), false);
});

test("purge 후 새 token 20회 공격도 session 6회 제한을 우회하지 못한다", async () => {
  resetFixtureSignupPriceGuideSecurityState();
  const cookie = createSignupPriceGuideSession(secret);
  const sessionId = readSignupPriceGuideSession(cookie, secret);
  let allowed = 0;
  let limited = 0;
  for (let index = 0; index < 20; index += 1) {
    const issued = issueSignupPriceGuideAnalysisToken({
      sessionId,
      deviceFingerprint: "meter_attack_device_1234",
      ip: "127.0.0.22",
      secret,
      nowMs: 10_000,
    });
    const token = verifySignupPriceGuideAnalysisToken({
      token: issued.token,
      sessionId,
      deviceFingerprint: "meter_attack_device_1234",
      ip: "127.0.0.22",
      secret,
      nowMs: 10_001,
    });
    try {
      await claimSignupPriceGuideAnalysis({
        supabase: null,
        token,
        fileHash: index.toString(16).padStart(64, "0"),
        estimatedCostMicroUsd: 0,
        dailyCostCapMicroUsd: 10_000,
        allowFixtureMemory: true,
        nowMs: 10_002,
      });
      allowed += 1;
      purgeFixtureSignupPriceGuideAnalysis(token.jti);
    } catch (error) {
      assert.ok(error instanceof SignupPriceGuideGuardError && error.code === "RATE_LIMITED");
      limited += 1;
    }
  }
  assert.equal(allowed, 6);
  assert.equal(limited, 14);
});

test("완료 후 purge해도 provider 일일 실제 비용은 유지된다", async () => {
  resetFixtureSignupPriceGuideSecurityState();
  const nowMs = Date.parse("2026-08-27T01:00:00Z");
  const makeToken = (suffix) => {
    const sessionId = readSignupPriceGuideSession(createSignupPriceGuideSession(secret), secret);
    const deviceFingerprint = `cost_meter_device_${suffix}_123456`;
    const ip = `127.0.1.${suffix}`;
    const issued = issueSignupPriceGuideAnalysisToken({ sessionId, deviceFingerprint, ip, secret, nowMs });
    return verifySignupPriceGuideAnalysisToken({ token: issued.token, sessionId, deviceFingerprint, ip, secret, nowMs: nowMs + 1 });
  };
  const first = makeToken(1);
  await claimSignupPriceGuideAnalysis({
    supabase: null,
    token: first,
    fileHash: "c".repeat(64),
    estimatedCostMicroUsd: 1_200,
    dailyCostCapMicroUsd: 2_000,
    allowFixtureMemory: true,
    nowMs,
  });
  markFixtureSignupPriceGuideAnalysisCompleted(first.jti, 1_200);
  purgeFixtureSignupPriceGuideAnalysis(first.jti);
  await assert.rejects(
    claimSignupPriceGuideAnalysis({
      supabase: null,
      token: makeToken(2),
      fileHash: "d".repeat(64),
      estimatedCostMicroUsd: 1_200,
      dailyCostCapMicroUsd: 2_000,
      allowFixtureMemory: true,
      nowMs,
    }),
    (error) => error instanceof SignupPriceGuideGuardError && error.code === "RATE_LIMITED",
  );
});

test("DB completion은 비용 원장과 cache를 v2 RPC 한 번으로 확정한다", async () => {
  const calls = [];
  await completeSignupPriceGuideAnalysis({
    supabase: { rpc: async (name, args) => { calls.push({ name, args }); return { data: true, error: null }; } },
    tokenJti: "33333333-3333-4333-8333-333333333333",
    actualCostMicroUsd: 1_200,
    cacheCiphertext: "fixture-encrypted-cache",
    cacheExpiresAt: "2026-08-27T01:05:00.000Z",
    allowFixtureMemory: false,
  });
  assert.equal(calls[0].name, "complete_signup_price_guide_analysis_v2");
  assert.equal(calls[0].args.p_actual_cost_microusd, 1_200);
});

test("짧은 TTL cache payload는 AES-GCM 암호화되며 원문을 포함하지 않는다", () => {
  const payload = { services: [{ name: "전체 미용", price: 80_000 }] };
  const encrypted = encryptSignupPriceGuideCache(payload, secret);
  assert.equal(encrypted.includes("전체 미용"), false);
  assert.deepEqual(decryptSignupPriceGuideCache(encrypted, secret), payload);
});

test("multipart hard limit은 8MB 이미지 정책과 별도 overhead를 둔다", () => {
  assert.equal(SIGNUP_PRICE_GUIDE_MULTIPART_OVERHEAD_BYTES, 512 * 1024);
  assert.equal(SIGNUP_PRICE_GUIDE_MULTIPART_MAX_BYTES, 8 * 1024 * 1024 + 512 * 1024);
});

test("큰 Content-Length는 body pull 전에 413으로 차단된다", async () => {
  let readCount = 0;
  const request = {
    headers: new Headers({ "content-length": "11" }),
    body: { getReader: () => ({ read: async () => { readCount += 1; return { done: true }; }, cancel: async () => {}, releaseLock: () => {} }) },
  };
  await assert.rejects(
    readBoundedSignupPriceGuideBody(request, { maxBytes: 10 }),
    (error) => error instanceof SignupPriceGuideMultipartError && error.code === "REQUEST_BODY_TOO_LARGE" && error.status === 413,
  );
  assert.equal(readCount, 0);
});

test("Content-Length가 없거나 거짓이어도 bounded stream이 초과 chunk를 413으로 중단한다", async () => {
  for (const contentLength of [null, "5"]) {
    let index = 0;
    const chunks = [new Uint8Array(6), new Uint8Array(6), new Uint8Array(6)];
    const headers = contentLength ? { "content-length": contentLength, "transfer-encoding": "chunked" } : { "transfer-encoding": "chunked" };
    const request = {
      headers: new Headers(headers),
      body: {
        getReader: () => ({
          read: async () => index >= chunks.length ? { done: true } : { done: false, value: chunks[index++] },
          cancel: async () => {},
          releaseLock: () => {},
        }),
      },
    };
    await assert.rejects(
      readBoundedSignupPriceGuideBody(request, { maxBytes: 10 }),
      (error) => error instanceof SignupPriceGuideMultipartError && error.code === "REQUEST_BODY_TOO_LARGE",
    );
    assert.equal(index, 2);
  }
});

test("slow upload은 전체 deadline에서 중단된다", async () => {
  const body = new ReadableStream({
    async pull(controller) {
      await new Promise((resolve) => setTimeout(resolve, 40));
      controller.enqueue(new Uint8Array([1]));
    },
  });
  const request = new Request("http://localhost/upload", { method: "POST", body, duplex: "half" });
  await assert.rejects(
    readBoundedSignupPriceGuideBody(request, { maxBytes: 10, timeoutMs: 10 }),
    (error) => error instanceof SignupPriceGuideMultipartError && error.code === "REQUEST_BODY_TIMEOUT" && error.status === 408,
  );
});
