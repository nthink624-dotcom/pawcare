import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { resolve } from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

const sourceRoot = fileURLToPath(new URL("../../src/", import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/server") return nextResolve("next/server.js", context);
    if (!specifier.startsWith("@/")) return nextResolve(specifier, context);
    const sourcePath = resolve(sourceRoot, specifier.slice(2));
    const candidate = [sourcePath, `${sourcePath}.ts`, `${sourcePath}.tsx`, resolve(sourcePath, "index.ts"), resolve(sourcePath, "index.tsx")]
      .find((path) => existsSync(path));
    if (!candidate) return nextResolve(specifier, context);
    return { url: pathToFileURL(candidate).href, shortCircuit: true };
  },
});

const {
  buildSignupServiceRpcPayload,
  parseSignupRequestPayload,
  SignupPriceGuideValidationError,
} = await import("../../src/server/signup-price-guide-validation.ts");
const { POST } = await import("../../src/app/api/auth/signup/route.ts");
const {
  ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER,
  ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
} = await import("../../src/lib/auth/atomic-signup-contract.ts");
const { OWNER_SIGNUP_TERMS_VERSION } = await import("../../src/lib/auth/owner-signup-terms.ts");

const routePath = new URL("../../src/app/api/auth/signup/route.ts", import.meta.url);
const validationPath = new URL("../../src/server/signup-price-guide-validation.ts", import.meta.url);
const v5MigrationPath = new URL("../../supabase/migrations/20260829023403_harden_atomic_owner_signup.sql", import.meta.url);
const v4MigrationPath = new URL("../../supabase/migrations/20260827064926_reused_phone_single_trial_signup.sql", import.meta.url);
const v1MigrationPath = new URL("../../supabase/migrations/202608270001_atomic_owner_signup_draft.sql", import.meta.url);

function canonicalDocument() {
  return {
    schemaVersion: 2,
    source: "manual",
    overallNote: "전체 요금표 메모",
    rows: [
      {
        serviceName: "소형견 목욕",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "소형견",
        sizeClass: "small",
        minKg: 0,
        maxKg: 5,
        priceKind: "fixed",
        priceMinKrw: 35_000,
        priceMaxKrw: null,
        durationMinutes: 45,
        note: "기본 목욕",
      },
      {
        serviceName: "고양이 미용",
        species: "cat",
        breedNames: [],
        breedGroup: null,
        sizeClass: "all",
        minKg: null,
        maxKg: null,
        priceKind: "starting",
        priceMinKrw: 55_000,
        priceMaxKrw: null,
        durationMinutes: 60,
        note: "상태에 따라 추가",
      },
      {
        serviceName: "공통 전체 미용",
        species: "all",
        breedNames: [],
        breedGroup: null,
        sizeClass: "all",
        minKg: 5,
        maxKg: 12,
        priceKind: "range",
        priceMinKrw: 80_000,
        priceMaxKrw: 120_000,
        durationMinutes: 90,
        note: null,
      },
    ],
    surcharges: [
      { condition: "심한 엉킴", amountKrw: 5_000, percent: null, note: "현장 확인" },
      { condition: "특수 케어", amountKrw: null, percent: 10, note: null },
    ],
    aiReview: [
      {
        targetId: "rows/0",
        field: "priceMinKrw",
        rawText: "35,000",
        confidence: "low",
        userConfirmed: true,
        userCorrected: false,
      },
      {
        targetId: "rows/1",
        field: "serviceName",
        rawText: "고양이 미용",
        confidence: "medium",
        userConfirmed: false,
        userCorrected: true,
      },
    ],
  };
}

function signupBody() {
  return {
    email: "owner@example.com",
    password: "Password123!",
    passwordConfirm: "Password123!",
    name: "김보호",
    birthDate: "19900101",
    phoneNumber: "010-1234-5678",
    identityVerificationToken: "verified-token",
    shopName: "행복 미용실",
    shopPhone: "02-1234-5678",
    shopAddress: "서울시 테스트구 1",
    agreements: { service: true, privacy: true, location: false, marketing: false },
    termsVersion: OWNER_SIGNUP_TERMS_VERSION,
    signupRequestId: "11111111-1111-4111-8111-111111111111",
    priceGuideDocument: canonicalDocument(),
    // V2 requests must ignore this compatibility copy and rebuild it centrally.
    servicePrices: [{
      id: "client-supplied-poison",
      name: "클라이언트 임의 행",
      detailName: "서버 저장 금지",
      price: 99_999_999,
      durationMinutes: 1_000,
      species: "dog",
      breedGroup: "",
      weightBand: "",
    }],
  };
}

function expectPriceGuideError(document, code) {
  assert.throws(
    () => parseSignupRequestPayload({ ...signupBody(), priceGuideDocument: document }),
    (error) => error instanceof SignupPriceGuideValidationError
      && error.status === 400
      && error.code === code
      && error.message.length > 0,
  );
}

test("signup rejects a stale or client-invented legal terms version", () => {
  assert.throws(() => parseSignupRequestPayload({ ...signupBody(), termsVersion: "2026-08-01" }));
  assert.doesNotThrow(() => parseSignupRequestPayload(signupBody()));
});

test("canonical V2 survives request parsing into v5 p_services without trusting client compatibility rows", () => {
  const document = canonicalDocument();
  const payload = parseSignupRequestPayload({ ...signupBody(), priceGuideDocument: document });
  const rpcServices = buildSignupServiceRpcPayload(payload, "shop-contract");

  assert.deepEqual(payload.priceGuideDocument, document);
  assert.deepEqual(payload.servicePrices.map((service) => service.name), [
    "소형견 목욕",
    "고양이 미용",
    "공통 전체 미용",
  ]);
  assert.deepEqual(rpcServices.map((service) => service.price), [35_000, 55_000, 80_000]);
  assert.deepEqual(rpcServices.map((service) => service.duration_minutes), [45, 60, 90]);
  assert.equal(rpcServices.some((service) => service.name === "클라이언트 임의 행"), false);
  for (const service of rpcServices) assert.deepEqual(service.price_guide, document);
});

test("legacy servicePrices-only clients keep the existing persistence path", () => {
  const body = signupBody();
  delete body.priceGuideDocument;
  body.servicePrices = [{
    id: "legacy-service",
    name: "기존 목욕",
    detailName: "기존 설명",
    price: 40_000,
    durationMinutes: 50,
    species: "dog",
    breedGroup: "소형견",
    weightBand: "5kg 이하",
  }];

  const payload = parseSignupRequestPayload(body);
  const rpcServices = buildSignupServiceRpcPayload(payload, "shop-legacy");

  assert.equal(payload.priceGuideDocument, undefined);
  assert.equal(rpcServices.length, 1);
  assert.equal(rpcServices[0].price, 40_000);
  assert.equal(rpcServices[0].duration_minutes, 50);
  assert.equal(rpcServices[0].price_guide.schemaVersion, 2);
  assert.equal(rpcServices[0].price_guide.source, "manual");
});

test("signup without a price guide defaults omitted servicePrices to an empty list", () => {
  const body = signupBody();
  delete body.priceGuideDocument;
  delete body.servicePrices;

  const payload = parseSignupRequestPayload(body);
  assert.equal(payload.priceGuideDocument, undefined);
  assert.deepEqual(payload.servicePrices, []);
  assert.deepEqual(buildSignupServiceRpcPayload(payload, "shop-no-price-guide"), []);
});

test("strict central V2 validation rejects malformed, unsafe, or unresolved documents", () => {
  const wrongVersion = canonicalDocument();
  wrongVersion.schemaVersion = 1;
  expectPriceGuideError(wrongVersion, "SIGNUP_PRICE_GUIDE_INVALID");

  const unsupportedSource = canonicalDocument();
  unsupportedSource.source = "raw_provider";
  expectPriceGuideError(unsupportedSource, "SIGNUP_PRICE_GUIDE_INVALID");

  const rawProviderPayload = { ...canonicalDocument(), providerResponse: { output: "raw" } };
  expectPriceGuideError(rawProviderPayload, "SIGNUP_PRICE_GUIDE_INVALID");

  const rawImagePayload = canonicalDocument();
  rawImagePayload.rows[0] = { ...rawImagePayload.rows[0], imageBase64: "data:image/png;base64,raw" };
  expectPriceGuideError(rawImagePayload, "SIGNUP_PRICE_GUIDE_INVALID");

  const empty = canonicalDocument();
  empty.rows = [];
  expectPriceGuideError(empty, "SIGNUP_PRICE_GUIDE_EMPTY");

  const missingService = canonicalDocument();
  missingService.rows[0].serviceName = null;
  expectPriceGuideError(missingService, "SIGNUP_PRICE_GUIDE_SERVICE_REQUIRED");

  const unresolvedPrice = canonicalDocument();
  unresolvedPrice.rows[0].priceKind = "unknown";
  unresolvedPrice.rows[0].priceMinKrw = null;
  expectPriceGuideError(unresolvedPrice, "SIGNUP_PRICE_GUIDE_PRICE_REQUIRED");

  const invalidKgBounds = canonicalDocument();
  invalidKgBounds.rows[0].minKg = 10;
  invalidKgBounds.rows[0].maxKg = 5;
  expectPriceGuideError(invalidKgBounds, "SIGNUP_PRICE_GUIDE_INVALID");

  const invalidRangeBounds = canonicalDocument();
  invalidRangeBounds.rows[2].priceMaxKrw = 70_000;
  expectPriceGuideError(invalidRangeBounds, "SIGNUP_PRICE_GUIDE_INVALID");

  const unresolvedReview = canonicalDocument();
  unresolvedReview.aiReview[0].userConfirmed = false;
  unresolvedReview.aiReview[0].userCorrected = false;
  expectPriceGuideError(unresolvedReview, "SIGNUP_PRICE_GUIDE_REVIEW_REQUIRED");
});

test("every V2 row needs an actual duration and a lossless central compatibility row", () => {
  const missingDuration = canonicalDocument();
  missingDuration.rows[0].durationMinutes = null;
  expectPriceGuideError(missingDuration, "SIGNUP_PRICE_GUIDE_DURATION_REQUIRED");

  const tooShortDuration = canonicalDocument();
  tooShortDuration.rows[0].durationMinutes = 4;
  expectPriceGuideError(tooShortDuration, "SIGNUP_PRICE_GUIDE_DURATION_REQUIRED");

  const unresolvedSpecies = canonicalDocument();
  unresolvedSpecies.rows[0].species = "unknown";
  expectPriceGuideError(unresolvedSpecies, "SIGNUP_PRICE_GUIDE_SPECIES_REQUIRED");

  const unresolvedSize = canonicalDocument();
  unresolvedSize.rows[0].sizeClass = "unknown";
  expectPriceGuideError(unresolvedSize, "SIGNUP_PRICE_GUIDE_SIZE_REQUIRED");
});

test("unknown species and size fail before environment, DB, or Auth work", async () => {
  for (const [field, code, message] of [
    ["species", "SIGNUP_PRICE_GUIDE_SPECIES_REQUIRED", "모든 요금 행의 반려동물 종류를 선택해 주세요."],
    ["sizeClass", "SIGNUP_PRICE_GUIDE_SIZE_REQUIRED", "모든 요금 행의 체급을 선택해 주세요."],
  ]) {
    const document = canonicalDocument();
    document.rows[0][field] = "unknown";
    const response = await POST(new Request("http://localhost/api/auth/signup", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
      },
      body: JSON.stringify({ ...signupBody(), priceGuideDocument: document }),
    }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { code, message });
  }
});

test("invalid V2 returns its safe 400 response before environment, DB, or Auth work", async () => {
  const unresolvedReview = canonicalDocument();
  unresolvedReview.aiReview[0].userConfirmed = false;
  unresolvedReview.aiReview[0].userCorrected = false;
  const response = await POST(new Request("http://localhost/api/auth/signup", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [ATOMIC_OWNER_SIGNUP_CONTRACT_HEADER]: ATOMIC_OWNER_SIGNUP_CONTRACT_VERSION,
    },
    body: JSON.stringify({ ...signupBody(), priceGuideDocument: unresolvedReview }),
  }));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    code: "SIGNUP_PRICE_GUIDE_REVIEW_REQUIRED",
    message: "확인하지 않은 AI 판독 항목을 모두 확인하거나 수정해 주세요.",
  });
});

test("existing v5 chain places each canonical document at p_services[].price_guide", async () => {
  const [v5Migration, v4Migration, v1Migration] = await Promise.all([
    readFile(v5MigrationPath, "utf8"),
    readFile(v4MigrationPath, "utf8"),
    readFile(v1MigrationPath, "utf8"),
  ]);

  assert.match(v5Migration, /return public\.complete_owner_signup_v4\([\s\S]*p_shop, p_profile, p_services, p_staff/);
  assert.match(v4Migration, /select public\.complete_owner_signup_v1\([\s\S]*p_shop, p_profile - array\['ci_hash', 'di_hash'\], p_services, p_staff/);
  assert.match(v1Migration, /jsonb_array_elements\(p_services\)/);
  assert.match(v1Migration, /coalesce\(v_service -> 'price_guide', '\{\}'::jsonb\)/);
});

test("route validates before Supabase/Auth work and preserves the accepted v5 request-id hunk", async () => {
  const [source, validationSource] = await Promise.all([
    readFile(routePath, "utf8"),
    readFile(validationPath, "utf8"),
  ]);
  const validationIndex = source.indexOf("const payload = parseSignupRequestPayload(body)");
  const supabaseClientIndex = source.indexOf("const supabase = getSupabaseAdmin()");
  const authMutationIndex = source.indexOf("supabase.auth.admin.createUser");

  assert.ok(validationIndex >= 0);
  assert.ok(validationIndex < supabaseClientIndex);
  assert.ok(validationIndex < authMutationIndex);
  assert.match(validationSource, /const compatibility = buildPriceGuideV2Compatibility\(priceGuideDocument\)/);
  assert.match(validationSource, /!compatibility\.storageValidation\.complete/);
  assert.match(source, /const normalizedServices = buildSignupServiceRpcPayload\(payload, shopId\)/);
  assert.match(source, /p_services: normalizedServices/);
  assert.match(source, /supabase\.rpc\("claim_owner_signup_v5"/);
  assert.match(source, /supabase\.rpc\("mark_owner_signup_auth_created_v5"/);
  assert.match(source, /supabase\.rpc\("complete_owner_signup_v5"/);
  assert.match(source, /signup_request_id: payload\.signupRequestId/);
  assert.doesNotMatch(source, /^export (?:type|class|function|const) /m);
  assert.deepEqual(Object.keys(await import("../../src/app/api/auth/signup/route.ts")), ["POST"]);
});
