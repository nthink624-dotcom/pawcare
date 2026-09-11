import { getAccessTokenWithRecovery } from "@/lib/api";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

import type {
  MobilePriceAnalysis,
  MobilePriceGuideCleanupBinding,
  MobilePriceGuideCleanupReceipt,
  MobilePriceDraft,
  MobilePriceGuideV2,
  MobilePersistedPriceGuide,
  MobilePricePhotoAdapter,
  MobileServiceSaveIntent,
  TransientPricePhoto,
} from "./mobile-price-photo-adapter";
import { ensureMobilePriceGuideSourceItemIds, isCanonicalKrwAmount } from "./mobile-price-photo-adapter";
import { createTransientCleanupRegistry } from "./mobile-price-photo-cleanup";

type FetchLike = typeof fetch;
type UploadIntent = {
  mediaAsset: { id: string };
  cleanupProof: string | null;
  cleanupBinding?: {
    requestCorrelationFingerprint?: string | null;
    correlationFingerprint?: string | null;
    assetFingerprint?: string | null;
    objectLifecycleFingerprint?: string | null;
  } | null;
  upload: { bucket: string; path: string; signedUrl?: string; token?: string | null; method?: string; headers?: Record<string, string> };
};
type ImportResponse = {
  document: MobilePriceGuideV2;
  sourceMediaAssetIds: unknown;
  cleanupReceipt?: MobilePriceGuideCleanupReceipt | null;
};
const MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE = "VISION_PROVIDER_INVALID_RESPONSE" as const;
const MOBILE_PRICE_PROVIDER_INVALID_SAFE_SUBTYPES = [
  "SCHEMA_INVALID",
  "AXIS_INVALID",
  "NO_ROWS",
  "SHAPE_INVALID",
] as const;

export type MobilePriceProviderInvalidSafeSubtype =
  (typeof MOBILE_PRICE_PROVIDER_INVALID_SAFE_SUBTYPES)[number];

type ErrorResponse = {
  message?: unknown;
  code?: unknown;
  safeSubtype?: unknown;
  cleanupReceipt?: unknown;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;
const REQUEST_FINGERPRINT_DOMAIN = "petmanager:price-guide-photo-request:v1";

class MobilePricePhotoHttpError extends Error {
  readonly cleanupReceipt: unknown;
  readonly code: typeof MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE | null;
  readonly safeSubtype: MobilePriceProviderInvalidSafeSubtype | null;

  constructor(
    message: string,
    cleanupReceipt: unknown,
    code: typeof MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE | null,
    safeSubtype: MobilePriceProviderInvalidSafeSubtype | null,
  ) {
    super(message);
    this.name = "MobilePricePhotoHttpError";
    this.cleanupReceipt = cleanupReceipt;
    this.code = code;
    this.safeSubtype = safeSubtype;
  }
}

export class MobilePricePhotoAuthenticationError extends Error {
  constructor() {
    super("로그인 정보를 확인하지 못했습니다.");
    this.name = "MobilePricePhotoAuthenticationError";
  }
}

export type MobilePricePhotoFailureStage = "upload_intent" | "upload" | "complete" | "import" | "cleanup";

export class MobilePricePhotoStageError extends Error {
  constructor(
    readonly stage: MobilePricePhotoFailureStage,
    readonly code: typeof MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE | null = null,
    readonly safeSubtype: MobilePriceProviderInvalidSafeSubtype | null = null,
    readonly cleanupReceipt: unknown = null,
  ) {
    super(stage);
    this.name = "MobilePricePhotoStageError";
  }
}

function stageError(stage: MobilePricePhotoFailureStage, error: unknown): never {
  if (error instanceof MobilePricePhotoAuthenticationError || error instanceof MobilePricePhotoStageError) throw error;
  if (error instanceof MobilePricePhotoHttpError) {
    throw new MobilePricePhotoStageError(stage, error.code, error.safeSubtype, error.cleanupReceipt);
  }
  throw new MobilePricePhotoStageError(stage);
}

export function getMobilePricePhotoRecoveryMessage(error: unknown) {
  if (!(error instanceof MobilePricePhotoStageError)) {
    return "사진 분석을 완료하지 못했습니다. 사진을 다시 선택해 주세요.";
  }
  if (error.stage === "import" && error.code === MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE) {
    switch (error.safeSubtype) {
      case "NO_ROWS":
        return "사진에서 요금표 항목을 찾지 못했어요. 표 전체가 보이도록 다시 촬영해 주세요.";
      case "AXIS_INVALID":
        return "체급과 서비스 구분을 확인하지 못했어요. 표의 행과 열이 모두 보이도록 다시 촬영해 주세요.";
      case "SHAPE_INVALID":
        return "요금표 행과 열을 맞추지 못했어요. 표를 정면에서 다시 촬영해 주세요.";
      case "SCHEMA_INVALID":
        return "사진 속 요금표 구조를 확인하지 못했어요. 표 전체가 보이도록 다시 촬영해 주세요.";
      default:
        return "사진 속 요금표 구조를 확인하지 못했어요. 더 선명한 사진으로 다시 시도해 주세요.";
    }
  }
  switch (error.stage) {
    case "upload_intent": return "사진 업로드 준비를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.";
    case "upload": return "사진 업로드가 완료되지 않았습니다. 사진을 다시 선택해 주세요.";
    case "complete": return "사진 업로드 확인이 완료되지 않았습니다. 잠시 후 다시 시도해 주세요.";
    case "import": return "사진 분석을 완료하지 못했습니다. 사진을 다시 선택해 주세요.";
    case "cleanup": return "사진 임시 파일 정리를 완료하지 못했습니다. 다시 시도해 주세요.";
  }
}

export function buildSingleSourcePhotoImportBody(shopId: string, mediaAssetIds: unknown[]) {
  if (mediaAssetIds.length !== 1 || typeof mediaAssetIds[0] !== "string" || !mediaAssetIds[0].trim()) {
    throw new Error("요금표 사진은 한 장만 선택해 주세요.");
  }
  return { shopId, mediaAssetIds: [mediaAssetIds[0]], privacyConfirmed: true };
}

async function createRequestFingerprint(clientCorrelationId: string) {
  if (!UUID_PATTERN.test(clientCorrelationId)) throw new Error("요금표 사진 요청을 안전하게 시작하지 못했습니다.");
  const encoded = new TextEncoder().encode(`${REQUEST_FINGERPRINT_DOMAIN}\n${clientCorrelationId}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

function bindCleanup(input: {
  clientCorrelationId: string;
  requestCorrelationFingerprint: string;
  mediaAssetId: string;
  cleanupProof: string;
  cleanupBinding: UploadIntent["cleanupBinding"];
}): MobilePriceGuideCleanupBinding {
  const binding = input.cleanupBinding;
  const values = [
    input.cleanupProof,
    binding?.requestCorrelationFingerprint,
    binding?.correlationFingerprint,
    binding?.assetFingerprint,
    binding?.objectLifecycleFingerprint,
  ];
  if (
    !UUID_PATTERN.test(input.clientCorrelationId)
    || !UUID_PATTERN.test(input.mediaAssetId)
    || binding?.requestCorrelationFingerprint !== input.requestCorrelationFingerprint
    || !values.every((value) => typeof value === "string" && FINGERPRINT_PATTERN.test(value))
  ) {
    throw new Error("요금표 사진 정리 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return {
    mediaAssetId: input.mediaAssetId,
    clientCorrelationId: input.clientCorrelationId,
    requestCorrelationFingerprint: input.requestCorrelationFingerprint,
    cleanupProof: input.cleanupProof,
    correlationFingerprint: binding.correlationFingerprint as string,
    assetFingerprint: binding.assetFingerprint as string,
    objectLifecycleFingerprint: binding.objectLifecycleFingerprint as string,
  };
}

function cleanupProofBody(binding: MobilePriceGuideCleanupBinding) {
  return {
    mediaAssetId: binding.mediaAssetId,
    proof: binding.cleanupProof,
    clientCorrelationId: binding.clientCorrelationId,
    requestCorrelationFingerprint: binding.requestCorrelationFingerprint,
    correlationFingerprint: binding.correlationFingerprint,
    assetFingerprint: binding.assetFingerprint,
    objectLifecycleFingerprint: binding.objectLifecycleFingerprint,
  };
}

function requireHardPurgeReceipt(binding: MobilePriceGuideCleanupBinding, value: unknown) {
  const receipt = value as Partial<MobilePriceGuideCleanupReceipt> | null | undefined;
  if (
    receipt?.hardPurged !== true
    || receipt.objectResidueCount !== 0
    || receipt.metadataResidueCount !== 0
    || receipt.requestCorrelationFingerprint !== binding.requestCorrelationFingerprint
    || receipt.correlationFingerprint !== binding.correlationFingerprint
    || receipt.assetFingerprint !== binding.assetFingerprint
    || receipt.objectLifecycleFingerprint !== binding.objectLifecycleFingerprint
    || typeof receipt.receiptFingerprint !== "string"
    || !FINGERPRINT_PATTERN.test(receipt.receiptFingerprint)
  ) {
    throw new Error("요금표 사진의 안전한 정리 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return receipt as MobilePriceGuideCleanupReceipt;
}

function requireMatchingSingleSourceMediaId(value: unknown, expected: string) {
  if (!Array.isArray(value) || value.length !== 1 || value[0] !== expected) {
    throw new Error("분석한 사진 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
}

function requireCleanupProof(value: unknown) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error("사진 임시 파일 정리 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
  }
  return value;
}

function normalizeBackendOrigin(value: string) {
  const url = new URL(value);
  if (url.pathname !== "/" || url.search || url.hash) throw new Error("PC API 주소를 확인해 주세요.");
  return url.origin;
}

async function responseJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => null) as ErrorResponse | null;
  if (!response.ok) {
    const code = body?.code === MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE
      ? MOBILE_PRICE_PROVIDER_INVALID_RESPONSE_CODE
      : null;
    const safeSubtype = code && MOBILE_PRICE_PROVIDER_INVALID_SAFE_SUBTYPES.includes(
      body?.safeSubtype as MobilePriceProviderInvalidSafeSubtype,
    )
      ? body?.safeSubtype as MobilePriceProviderInvalidSafeSubtype
      : null;
    throw new MobilePricePhotoHttpError(
      code
        ? "사진 속 요금표 구조를 확인하지 못했습니다."
        : typeof body?.message === "string"
          ? body.message
          : "요청을 처리하지 못했습니다. 다시 시도해 주세요.",
      body?.cleanupReceipt,
      code,
      safeSubtype,
    );
  }
  return body as T;
}

export function toMobilePriceDrafts(document: MobilePriceGuideV2): MobilePriceDraft[] {
  return document.rows.map((row, rowIndex) => ({
    clientId: `price-row-${rowIndex}`,
    rowIndex,
    serviceName: row.serviceName ?? "",
    priceKind: row.priceKind,
    fixedPrice: row.priceKind === "fixed" ? row.priceMinKrw : null,
    minimumPrice: row.priceMinKrw,
    maximumPrice: row.priceMaxKrw,
    durationMinutes: row.durationMinutes,
  }));
}

function assertCanonicalPriceDocument(document: MobilePriceGuideV2) {
  for (const row of document.rows) {
    if (row.priceKind === "unknown") {
      if (row.priceMinKrw !== null && !isCanonicalKrwAmount(row.priceMinKrw)) {
        throw new Error("가격은 0원부터 100,000,000원까지 정수로 입력해 주세요.");
      }
      if (row.priceMaxKrw !== null) throw new Error("상담 후 결정 가격 정보를 확인해 주세요.");
      continue;
    }
    if (!isCanonicalKrwAmount(row.priceMinKrw)) throw new Error("가격은 0원부터 100,000,000원까지 정수로 입력해 주세요.");
    if (row.priceKind === "range") {
      if (!isCanonicalKrwAmount(row.priceMaxKrw) || row.priceMaxKrw < row.priceMinKrw) {
        throw new Error("최대 가격은 최소 가격 이상인 100,000,000원 이하 정수로 입력해 주세요.");
      }
    } else if (row.priceMaxKrw !== null) {
      throw new Error("가격 정보를 확인해 주세요.");
    }
  }
}

export function isMobilePriceGuideV2(value: unknown): value is MobilePriceGuideV2 {
  if (!value || typeof value !== "object") return false;
  const document = value as Partial<MobilePriceGuideV2>;
  return document.schemaVersion === 2
    && Array.isArray(document.rows)
    && Array.isArray(document.surcharges)
    && Array.isArray(document.aiReview);
}

export function applyDraftsToDocument(document: MobilePriceGuideV2, drafts: MobilePriceDraft[]): MobilePriceGuideV2 {
  const byIndex = new Map(drafts.map((draft) => [draft.rowIndex, draft]));
  return {
    ...document,
    source: document.source === "manual" ? "manual" : "owner_corrected",
    rows: document.rows.map((row, rowIndex) => {
      const draft = byIndex.get(rowIndex);
      if (!draft) return row;
      const minimum = draft.priceKind === "fixed" ? draft.fixedPrice : draft.minimumPrice;
      return {
        ...row,
        serviceName: draft.serviceName.trim() || null,
        priceKind: draft.priceKind,
        priceMinKrw: minimum,
        priceMaxKrw: draft.priceKind === "range" ? draft.maximumPrice : null,
        durationMinutes: draft.durationMinutes,
      };
    }),
  };
}

export function createManualPriceDocument(drafts: MobilePriceDraft[]): MobilePriceGuideV2 {
  return ensureMobilePriceGuideSourceItemIds(applyDraftsToDocument({ schemaVersion: 2, source: "manual", overallNote: null, rows: drafts.map(() => ({
    serviceName: null, species: "all", breedNames: [], breedGroup: null, sizeClass: "all", minKg: null, maxKg: null,
    priceKind: "unknown", priceMinKrw: null, priceMaxKrw: null, durationMinutes: null, note: null,
  })), surcharges: [], aiReview: [] }, drafts));
}

export function createMobilePricePhotoHttpAdapter(options: {
  backendOrigin: string;
  shopId: string;
  accessToken?: () => string | null | Promise<string | null>;
  fetchImpl?: FetchLike;
}): MobilePricePhotoAdapter {
  const origin = normalizeBackendOrigin(options.backendOrigin);
  const fetchImpl = options.fetchImpl ?? fetch;
  const accessToken = options.accessToken ?? getAccessTokenWithRecovery;
  const analyzedRunIds = new Set<number>();
  const cleanupBindingByReference = new Map<string, MobilePriceGuideCleanupBinding>();
  const verifiedPurgeReferences = new Set<string>();

  const pcRequest = async <T>(path: string, init: RequestInit = {}) => {
    let token: string | null;
    try {
      token = await accessToken();
    } catch (error) {
      if (error instanceof Error && error.message === "로그인이 필요합니다.") throw new MobilePricePhotoAuthenticationError();
      throw error;
    }
    if (!token) throw new MobilePricePhotoAuthenticationError();
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${token}`);
    if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    return responseJson<T>(await fetchImpl(`${origin}${path}`, { ...init, headers, credentials: "omit" }));
  };

  const cleanupRegistry = createTransientCleanupRegistry(async (reference) => {
    const binding = cleanupBindingByReference.get(reference);
    if (!binding) throw new Error("사진 임시 파일 정리 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
    if (verifiedPurgeReferences.has(reference)) {
      cleanupBindingByReference.delete(reference);
      verifiedPurgeReferences.delete(reference);
      return;
    }
    const result = await pcRequest<{ cleanupReceipt?: MobilePriceGuideCleanupReceipt | null }>("/api/owner/price-guide-photo-import", {
      method: "DELETE",
      body: JSON.stringify({
        shopId: options.shopId,
        mediaAssetIds: [reference],
        cleanupProofs: [cleanupProofBody(binding)],
      }),
    });
    requireHardPurgeReceipt(binding, result.cleanupReceipt);
    cleanupBindingByReference.delete(reference);
  });

  return {
    async uploadTransientPhoto(file, context) {
      await cleanupRegistry.retryPending();
      const clientCorrelationId = crypto.randomUUID();
      const requestCorrelationFingerprint = await createRequestFingerprint(clientCorrelationId);
      let intent: UploadIntent;
      try {
        intent = await pcRequest<UploadIntent>("/api/owner/media/upload-intents", {
          method: "POST",
          signal: context.signal,
          body: JSON.stringify({
            shopId: options.shopId, originalFileName: file.name, contentType: file.type, byteSize: file.size,
            sourceByteSize: file.size, width: null, height: null, mediaKind: "price_guide_source", visibility: "private",
            retentionPolicy: "archive", uploadedFrom: "owner_mobile",
            clientCorrelationId,
            requestCorrelationFingerprint,
          }),
        });
      } catch (error) {
        stageError("upload_intent", error);
      }
      const reference = intent.mediaAsset.id;
      let cleanupProof: string;
      let cleanupBinding: MobilePriceGuideCleanupBinding;
      try {
        cleanupProof = requireCleanupProof(intent.cleanupProof);
        cleanupBinding = bindCleanup({
          clientCorrelationId,
          requestCorrelationFingerprint,
          mediaAssetId: reference,
          cleanupProof,
          cleanupBinding: intent.cleanupBinding,
        });
      } catch (error) {
        stageError("upload_intent", error);
      }
      cleanupBindingByReference.set(reference, cleanupBinding);
      cleanupRegistry.acquire(reference);

      try {
        if (intent.upload.method === "PUT" && intent.upload.signedUrl) {
          const uploaded = await fetchImpl(intent.upload.signedUrl, { method: "PUT", headers: { "Content-Type": file.type, ...(intent.upload.headers ?? {}) }, body: file, signal: context.signal });
          if (!uploaded.ok) throw new MobilePricePhotoStageError("upload");
        } else {
          const supabase = getSupabaseBrowserClient();
          if (!supabase || !intent.upload.token) throw new MobilePricePhotoStageError("upload");
          const uploaded = await supabase.storage.from(intent.upload.bucket).uploadToSignedUrl(intent.upload.path, intent.upload.token, file, { contentType: file.type, upsert: false });
          if (uploaded.error) throw new MobilePricePhotoStageError("upload");
        }

        try {
          await pcRequest("/api/owner/media/complete", {
            method: "POST", signal: context.signal,
            body: JSON.stringify({ shopId: options.shopId, mediaAssetId: reference, byteSize: file.size, width: null, height: null }),
          });
        } catch (error) {
          stageError("complete", error);
        }
        return { reference, cleanupProof, cleanupBinding };
      } catch (error) {
        try {
          await cleanupRegistry.cleanup(reference);
        } catch {
          throw new MobilePricePhotoStageError("cleanup");
        }
        stageError("upload", error);
      }
    },

    async analyzeTransientPhoto(photo, context): Promise<MobilePriceAnalysis> {
      if (analyzedRunIds.has(context.runId)) throw new Error("사진 분석은 한 번만 진행할 수 있습니다.");
      const body = buildSingleSourcePhotoImportBody(options.shopId, [photo.reference]);
      analyzedRunIds.add(context.runId);
      try {
        let result: ImportResponse;
        try {
          result = await pcRequest<ImportResponse>("/api/owner/price-guide-photo-import", {
            method: "POST", signal: context.signal,
            body: JSON.stringify({ ...body, cleanupProofs: [cleanupProofBody(photo.cleanupBinding)] }),
          });
          requireMatchingSingleSourceMediaId(result.sourceMediaAssetIds, photo.reference);
        } catch (error) {
          stageError("import", error);
        }
        try {
          requireHardPurgeReceipt(photo.cleanupBinding, result.cleanupReceipt);
        } catch (error) {
          stageError("cleanup", error);
        }
        verifiedPurgeReferences.add(photo.reference);
        const document = ensureMobilePriceGuideSourceItemIds(result.document);
        return { document, drafts: toMobilePriceDrafts(document) };
      } catch (error) {
        if (
          (error instanceof MobilePricePhotoHttpError || error instanceof MobilePricePhotoStageError)
          && error.cleanupReceipt
        ) {
          try {
            requireHardPurgeReceipt(photo.cleanupBinding, error.cleanupReceipt);
          } catch (cleanupError) {
            stageError("cleanup", cleanupError);
          }
          verifiedPurgeReferences.add(photo.reference);
        }
        stageError("import", error);
      }
    },

    async cleanupTransientPhoto(photo) {
      if (cleanupBindingByReference.get(photo.reference)?.cleanupProof !== photo.cleanupProof) {
        throw new Error("사진 임시 파일 정리 정보를 확인하지 못했습니다. 다시 시도해 주세요.");
      }
      await cleanupRegistry.cleanup(photo.reference);
    },

    async saveServices(document, intent: MobileServiceSaveIntent, signal) {
      await cleanupRegistry.retryPending();
      assertCanonicalPriceDocument(document);
      const primary = document.rows.find((row) => (
        row.serviceName?.trim()
        && row.priceKind !== "unknown"
        && isCanonicalKrwAmount(row.priceMinKrw)
        && Number.isInteger(row.durationMinutes)
        && (row.durationMinutes ?? 0) >= 1
        && (row.durationMinutes ?? 0) <= 1_440
      ));
      if (!primary?.serviceName || primary.priceMinKrw === null || primary.durationMinutes === null) {
        throw new Error("서비스명·가격·평균 시간이 입력된 행을 한 개 이상 확인해 주세요.");
      }
      const price = primary.priceMinKrw;
      await pcRequest("/api/services", {
        method: "POST", signal,
        body: JSON.stringify({
          shopId: options.shopId, serviceId: intent.serviceId, operation: intent.operation, requestId: intent.requestId,
          name: primary.serviceName, price,
          priceType: primary.priceKind === "fixed" ? "fixed" : "starting",
          durationMinutes: primary.durationMinutes, isActive: true, category: "미용", description: "",
          sortOrder: 1, capacityLabel: "동일 시간 1건", staffSelectionMode: "all", priceGuide: document,
        }),
      });
    },

    async requeryServices(serviceId, signal): Promise<MobilePersistedPriceGuide> {
      const bootstrap = await pcRequest<{ services?: Array<{ id?: unknown; price_guide?: unknown }> }>(`/api/bootstrap?shopId=${encodeURIComponent(options.shopId)}&phase=essential`, { cache: "no-store", signal });
      const service = (bootstrap.services ?? []).find((item) => item.id === serviceId);
      const document = service?.price_guide;
      if (!isMobilePriceGuideV2(document)) {
        throw new Error("저장한 요금표를 다시 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
      }
      const canonicalDocument = ensureMobilePriceGuideSourceItemIds(document);
      return { serviceId, document: canonicalDocument, drafts: toMobilePriceDrafts(canonicalDocument) };
    },
  };
}
