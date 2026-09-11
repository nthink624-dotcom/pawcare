export type MobilePriceKind = "fixed" | "starting" | "range" | "unknown";

export type MobilePriceGuideRow = {
  sourceItemId?: string;
  serviceName: string | null;
  species: "dog" | "cat" | "all" | "unknown";
  breedNames: string[];
  breedGroup: string | null;
  sizeClass: "small" | "medium" | "large" | "extra-large" | "all" | "unknown";
  minKg: number | null;
  maxKg: number | null;
  weightBandLabel?: string | null;
  priceKind: MobilePriceKind;
  priceMinKrw: number | null;
  priceMaxKrw: number | null;
  durationMinutes: number | null;
  note: string | null;
};

export type MobilePriceGuideWeightBand = {
  label: string;
  minKg: number | null;
  maxKg: number | null;
  note: string | null;
};

export type MobilePriceGuideTableGroup = {
  sourceLabel: string;
  species: MobilePriceGuideRow["species"];
  breedNames: string[];
  sizeClass: MobilePriceGuideRow["sizeClass"];
  weightBands: MobilePriceGuideWeightBand[];
  serviceNames: string[];
  note: string | null;
};

export type MobilePriceGuideV2 = {
  schemaVersion: 2;
  source: "ai_imported" | "owner_corrected" | "vision" | "fixture" | "manual" | "owner_confirmed" | "legacy";
  overallNote: string | null;
  rows: MobilePriceGuideRow[];
  tableGroups?: MobilePriceGuideTableGroup[];
  surcharges: Array<{ condition: string | null; amountKrw: number | null; percent: number | null; note: string | null }>;
  aiReview: Array<{ targetId: string; field: string; rawText: string; confidence: "medium" | "low"; userConfirmed: boolean; userCorrected: boolean }>;
};

export type MobilePriceDraft = {
  clientId: string;
  rowIndex: number;
  serviceName: string;
  priceKind: MobilePriceKind;
  fixedPrice: number | null;
  minimumPrice: number | null;
  maximumPrice: number | null;
  durationMinutes: number | null;
};

export type MobilePriceAnalysis = {
  document: MobilePriceGuideV2;
  drafts: MobilePriceDraft[];
};

export type MobilePersistedPriceGuide = {
  serviceId: string;
  document: MobilePriceGuideV2;
  drafts: MobilePriceDraft[];
};

export const MAX_SERVICE_PRICE_KRW = 100_000_000;

export function isCanonicalKrwAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_SERVICE_PRICE_KRW;
}

function normalizeSourceIdentityText(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

function stableSourceIdentityHash(value: string) {
  const hashWithSeed = (seed: number) => {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16_777_619) >>> 0;
    }
    return hash.toString(36).padStart(7, "0");
  };
  return `${hashWithSeed(2_166_136_261)}${hashWithSeed(3_332_248_983)}`;
}

export function ensureMobilePriceGuideSourceItemIds(document: MobilePriceGuideV2): MobilePriceGuideV2 {
  const occurrences = new Map<string, number>();
  let changed = false;
  const rows = document.rows.map((row) => {
    const identity = JSON.stringify([
      normalizeSourceIdentityText(row.serviceName),
      row.species,
      row.breedNames.map(normalizeSourceIdentityText).sort(),
      normalizeSourceIdentityText(row.breedGroup),
      row.sizeClass,
      row.minKg,
      row.maxKg,
      normalizeSourceIdentityText(row.weightBandLabel),
    ]);
    const occurrence = (occurrences.get(identity) ?? 0) + 1;
    occurrences.set(identity, occurrence);
    if (row.sourceItemId) return row;
    changed = true;
    return { ...row, sourceItemId: `pgi_${stableSourceIdentityHash(`${identity}\u0000${occurrence}`)}` };
  });
  return changed ? { ...document, rows } : document;
}

export type MobileServiceSaveIntent = {
  operation: "create" | "update";
  serviceId: string;
  requestId: string;
};

export type TransientPricePhoto = {
  reference: string;
  cleanupProof: string;
  cleanupBinding: MobilePriceGuideCleanupBinding;
};

export type MobilePriceGuideCleanupBinding = {
  mediaAssetId: string;
  clientCorrelationId: string;
  requestCorrelationFingerprint: string;
  cleanupProof: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
};

export type MobilePriceGuideCleanupReceipt = {
  hardPurged: true;
  alreadyPurged: boolean;
  requestCorrelationFingerprint: string;
  correlationFingerprint: string;
  assetFingerprint: string;
  objectLifecycleFingerprint: string;
  objectResidueCount: 0;
  metadataResidueCount: 0;
  receiptFingerprint: string;
};

export type MobilePricePhotoContext = {
  runId: number;
  signal: AbortSignal;
};

export interface MobilePricePhotoAdapter {
  uploadTransientPhoto(file: File, context: MobilePricePhotoContext): Promise<TransientPricePhoto>;
  analyzeTransientPhoto(photo: TransientPricePhoto, context: MobilePricePhotoContext): Promise<MobilePriceAnalysis>;
  cleanupTransientPhoto(photo: TransientPricePhoto, reason: "analyzed" | "cancelled" | "failed"): Promise<void>;
  saveServices(document: MobilePriceGuideV2, intent: MobileServiceSaveIntent, signal: AbortSignal): Promise<void>;
  requeryServices(serviceId: string, signal: AbortSignal): Promise<MobilePersistedPriceGuide>;
}

export type MobilePricePhotoCoordinator = {
  analyze(file: File): Promise<MobilePriceAnalysis>;
  saveAndRequery(document: MobilePriceGuideV2, persistedServiceId?: string | null): Promise<MobilePersistedPriceGuide>;
  cancel(): void;
};

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

export function createMobilePricePhotoCoordinator(adapter: MobilePricePhotoAdapter): MobilePricePhotoCoordinator {
  let activeRunId = 0;
  let activeController: AbortController | null = null;
  let saveAttempt: { fingerprint: string; intent: MobileServiceSaveIntent } | null = null;
  let saveInFlight: { fingerprint: string; promise: Promise<MobilePersistedPriceGuide> } | null = null;

  const cancel = () => {
    activeRunId += 1;
    activeController?.abort();
    activeController = null;
  };

  return {
    async analyze(file) {
      cancel();
      const runId = activeRunId;
      const controller = new AbortController();
      activeController = controller;
      const context = { runId, signal: controller.signal };
      let photo: TransientPricePhoto | null = null;
      let cleaned = false;
      let cleanupInFlight: Promise<void> | null = null;
      let cleanupReason: "analyzed" | "cancelled" | "failed" = "failed";
      let analysis: MobilePriceAnalysis | null = null;
      let analysisError: unknown = null;

      const cleanupOnce = async () => {
        if (!photo || cleaned) return;
        cleanupInFlight ??= adapter.cleanupTransientPhoto(photo, cleanupReason);
        await cleanupInFlight;
        cleaned = true;
      };

      try {
        photo = await adapter.uploadTransientPhoto(file, context);
        if (controller.signal.aborted || runId !== activeRunId) {
          cleanupReason = "cancelled";
          throw abortError();
        }

        analysis = await adapter.analyzeTransientPhoto(photo, context);
        if (controller.signal.aborted || runId !== activeRunId) {
          cleanupReason = "cancelled";
          throw abortError();
        }
        cleanupReason = "analyzed";
      } catch (error) {
        if (controller.signal.aborted || runId !== activeRunId) cleanupReason = "cancelled";
        analysisError = error;
      } finally {
        await cleanupOnce();
        if (runId === activeRunId) activeController = null;
      }

      if (analysisError) throw analysisError;
      if (controller.signal.aborted || runId !== activeRunId) throw abortError();
      if (!analysis) throw new Error("사진 분석 결과를 확인하지 못했습니다. 다시 시도해 주세요.");
      return analysis;
    },

    async saveAndRequery(document, persistedServiceId = null) {
      const fingerprint = JSON.stringify({ document, persistedServiceId });
      if (saveInFlight?.fingerprint === fingerprint) return saveInFlight.promise;
      if (!saveAttempt || saveAttempt.fingerprint !== fingerprint) {
        saveAttempt = {
          fingerprint,
          intent: {
            operation: persistedServiceId ? "update" : "create",
            serviceId: persistedServiceId ?? crypto.randomUUID(),
            requestId: crypto.randomUUID(),
          },
        };
      }
      const attempt = saveAttempt;
      const controller = new AbortController();
      let promise!: Promise<MobilePersistedPriceGuide>;
      promise = (async () => {
        await adapter.saveServices(document, attempt.intent, controller.signal);
        const persisted = await adapter.requeryServices(attempt.intent.serviceId, controller.signal);
        if (saveAttempt === attempt) saveAttempt = null;
        return persisted;
      })().finally(() => {
        if (saveInFlight?.promise === promise) saveInFlight = null;
      });
      saveInFlight = { fingerprint, promise };
      return promise;
    },

    cancel,
  };
}
