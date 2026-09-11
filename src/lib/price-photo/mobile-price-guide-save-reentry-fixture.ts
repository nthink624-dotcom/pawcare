import type { MobilePriceGuideV2 } from "./mobile-price-photo-adapter";

const FIXTURE_TOKEN = "dev-price-guide-owner-token";
const FIXTURE_SHOP_ID = "dev-price-guide-shop";
const FIXTURE_SERVICE_ID = "11111111-1111-4111-8111-111111111111";
const FIXTURE_MEDIA_ID = "22222222-2222-4222-8222-222222222222";
const CLEANUP_PROOF = "a".repeat(64);
const CORRELATION_FINGERPRINT = "b".repeat(64);
const ASSET_FINGERPRINT = "c".repeat(64);
const OBJECT_LIFECYCLE_FINGERPRINT = "d".repeat(64);
const RECEIPT_FINGERPRINT = "e".repeat(64);

export type PriceGuideFixtureRequestCounts = {
  uploadIntent: number;
  signedPut: number;
  complete: number;
  photoImport: number;
  cleanupDelete: number;
  servicesPost: number;
  bootstrapGet: number;
};

export type PriceGuideFixtureSnapshot = {
  counts: PriceGuideFixtureRequestCounts;
  authenticatedRequests: number;
  credentialsOmitted: boolean;
  noStoreBootstrap: boolean;
  requestCorrelationFingerprint: string | null;
  cleanupBindingVerified: boolean;
  residueCount: number;
};

function cloneDocument(document: MobilePriceGuideV2) {
  return structuredClone(document);
}

export function createPriceGuideSaveReentryFixtureDocument(): MobilePriceGuideV2 {
  return {
    schemaVersion: 2,
    source: "owner_corrected",
    overallNote: "개발 전용 저장·재진입 검증",
    tableGroups: [{
      sourceLabel: "베이직",
      species: "dog",
      breedNames: ["말티즈", "푸들"],
      sizeClass: "small",
      weightBands: [
        { label: "2kg 이하", minKg: null, maxKg: 2, note: null },
        { label: "2~4kg", minKg: 2, maxKg: 4, note: null },
      ],
      serviceNames: ["목욕", "전체 미용"],
      note: null,
    }],
    rows: [
      {
        sourceItemId: "pgi_fixture_bath_2kg",
        serviceName: "목욕",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "베이직",
        sizeClass: "small",
        minKg: null,
        maxKg: 2,
        weightBandLabel: "2kg 이하",
        priceKind: "fixed",
        priceMinKrw: 30_000,
        priceMaxKrw: null,
        durationMinutes: 45,
        note: null,
      },
      {
        sourceItemId: "pgi_fixture_full_2kg",
        serviceName: "전체 미용",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "베이직",
        sizeClass: "small",
        minKg: null,
        maxKg: 2,
        weightBandLabel: "2kg 이하",
        priceKind: "unknown",
        priceMinKrw: 60_000,
        priceMaxKrw: null,
        durationMinutes: null,
        note: "가격 방식과 평균 시간 확인 필요",
      },
      {
        sourceItemId: "pgi_fixture_bath_4kg",
        serviceName: "목욕",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "베이직",
        sizeClass: "small",
        minKg: 2,
        maxKg: 4,
        weightBandLabel: "2~4kg",
        priceKind: "fixed",
        priceMinKrw: 35_000,
        priceMaxKrw: null,
        durationMinutes: 55,
        note: null,
      },
      {
        sourceItemId: "pgi_fixture_full_4kg",
        serviceName: "전체 미용",
        species: "dog",
        breedNames: ["말티즈", "푸들"],
        breedGroup: "베이직",
        sizeClass: "small",
        minKg: 2,
        maxKg: 4,
        weightBandLabel: "2~4kg",
        priceKind: "fixed",
        priceMinKrw: 70_000,
        priceMaxKrw: null,
        durationMinutes: 100,
        note: null,
      },
    ],
    surcharges: [],
    aiReview: [],
  };
}

function emptyCounts(): PriceGuideFixtureRequestCounts {
  return { uploadIntent: 0, signedPut: 0, complete: 0, photoImport: 0, cleanupDelete: 0, servicesPost: 0, bootstrapGet: 0 };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function createInMemoryAuthenticatedOwnerTransport(options: { cleanupResidueCount?: number } = {}) {
  const counts = emptyCounts();
  const cleanupResidueCount = options.cleanupResidueCount ?? 0;
  let authenticatedRequests = 0;
  let credentialsOmitted = true;
  let noStoreBootstrap = true;
  let requestCorrelationFingerprint: string | null = null;
  let canonicalDocument = createPriceGuideSaveReentryFixtureDocument();
  let serviceId = FIXTURE_SERVICE_ID;

  const cleanupReceipt = (binding: Record<string, unknown>) => ({
    hardPurged: true,
    alreadyPurged: false,
    requestCorrelationFingerprint: String(binding.requestCorrelationFingerprint ?? ""),
    correlationFingerprint: String(binding.correlationFingerprint ?? ""),
    assetFingerprint: String(binding.assetFingerprint ?? ""),
    objectLifecycleFingerprint: String(binding.objectLifecycleFingerprint ?? ""),
    objectResidueCount: cleanupResidueCount,
    metadataResidueCount: cleanupResidueCount,
    receiptFingerprint: RECEIPT_FINGERPRINT,
  });

  const fetchImpl: typeof fetch = async (input, init = {}) => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.origin === "https://fixture-upload.invalid") {
      counts.signedPut += 1;
      return new Response(null, { status: 200 });
    }

    const headers = new Headers(init.headers);
    const authenticated = headers.get("authorization") === `Bearer ${FIXTURE_TOKEN}`;
    credentialsOmitted = credentialsOmitted && init.credentials === "omit";
    if (!authenticated) return json({ message: "로그인이 필요합니다." }, 401);
    authenticatedRequests += 1;

    if (url.pathname === "/api/owner/media/upload-intents" && init.method === "POST") {
      counts.uploadIntent += 1;
      const body = JSON.parse(String(init.body)) as { requestCorrelationFingerprint?: string };
      requestCorrelationFingerprint = body.requestCorrelationFingerprint ?? null;
      return json({
        mediaAsset: { id: FIXTURE_MEDIA_ID },
        cleanupProof: CLEANUP_PROOF,
        cleanupBinding: {
          requestCorrelationFingerprint,
          correlationFingerprint: CORRELATION_FINGERPRINT,
          assetFingerprint: ASSET_FINGERPRINT,
          objectLifecycleFingerprint: OBJECT_LIFECYCLE_FINGERPRINT,
        },
        upload: { bucket: "fixture", path: "fixture", method: "PUT", signedUrl: "https://fixture-upload.invalid/one" },
      });
    }

    if (url.pathname === "/api/owner/media/complete" && init.method === "POST") {
      counts.complete += 1;
      return json({ ok: true });
    }

    if (url.pathname === "/api/owner/price-guide-photo-import" && init.method === "POST") {
      counts.photoImport += 1;
      const body = JSON.parse(String(init.body)) as { cleanupProofs: Array<Record<string, unknown>> };
      return json({
        document: cloneDocument(canonicalDocument),
        sourceMediaAssetIds: [FIXTURE_MEDIA_ID],
        cleanupReceipt: cleanupReceipt(body.cleanupProofs[0]),
      });
    }

    if (url.pathname === "/api/owner/price-guide-photo-import" && init.method === "DELETE") {
      counts.cleanupDelete += 1;
      const body = JSON.parse(String(init.body)) as { cleanupProofs: Array<Record<string, unknown>> };
      return json({ cleanupReceipt: cleanupReceipt(body.cleanupProofs[0]) });
    }

    if (url.pathname === "/api/services" && init.method === "POST") {
      counts.servicesPost += 1;
      const body = JSON.parse(String(init.body)) as { serviceId: string; priceGuide: MobilePriceGuideV2 };
      serviceId = body.serviceId;
      canonicalDocument = cloneDocument(body.priceGuide);
      return json({ ok: true });
    }

    if (url.pathname === "/api/bootstrap" && (init.method === undefined || init.method === "GET")) {
      counts.bootstrapGet += 1;
      noStoreBootstrap = noStoreBootstrap && init.cache === "no-store";
      return json({ services: [{ id: serviceId, price_guide: cloneDocument(canonicalDocument) }] });
    }

    return json({ message: "허용되지 않은 개발 전용 요청입니다." }, 404);
  };

  return {
    backendOrigin: "https://fixture-owner.invalid",
    shopId: FIXTURE_SHOP_ID,
    serviceId: FIXTURE_SERVICE_ID,
    accessToken: async () => FIXTURE_TOKEN,
    fetchImpl,
    resetSaveCycle() {
      counts.servicesPost = 0;
      counts.bootstrapGet = 0;
      noStoreBootstrap = true;
    },
    canonicalDocument() {
      return cloneDocument(canonicalDocument);
    },
    snapshot(): PriceGuideFixtureSnapshot {
      return {
        counts: { ...counts },
        authenticatedRequests,
        credentialsOmitted,
        noStoreBootstrap,
        requestCorrelationFingerprint,
        cleanupBindingVerified: Boolean(requestCorrelationFingerprint) && cleanupResidueCount === 0,
        residueCount: cleanupResidueCount,
      };
    },
  };
}
