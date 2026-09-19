"use client";

import Image from "next/image";
import { ArrowLeft, Check, ImagePlus, LoaderCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { validatePriceGuideDocument } from "@/components/auth/signup-price-guide-editor";
import PriceGuideManualOnboarding from "@/components/owner-web/price-guide-manual-onboarding";
import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import PriceGuideOnboardingChoice from "@/components/owner-web/price-guide-onboarding-choice";
import { usePriceGuideTemporaryDraft } from "@/components/owner-web/use-price-guide-temporary-draft";
import PriceGuideV2ServiceDetail, { isFixedManualPriceGuideDocument } from "@/components/owner-web/price-guide-v2-service-detail";
import type { ServicePriceGuide } from "@/components/owner-web/service-price-guide";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  cleanupOwnerPriceGuideSourceUpload,
  createOwnerMediaAssetFromFile,
  rememberOwnerPriceGuideHardPurgeReceipt,
} from "@/lib/media/owner-media-client";
import {
  readPriceGuidePhotoSupportCode,
  reportPriceGuidePhotoLifecycle,
} from "@/lib/media/price-guide-photo-lifecycle";
import {
  buildPriceGuideHardPurgeRequest,
  type PriceGuideUploadCleanupBinding,
} from "@/lib/media/price-guide-upload-correlation";
import { cleanupLatePhotoAnalysisResult } from "@/lib/price-guide-photo-analysis-client";
import { createPriceGuidePhotoImportFixture } from "@/lib/price-guide-photo-import-fixture";
import type { PriceGuidePhotoImportResponse, PriceGuideV2 } from "@/types/price-guide-photo-import";

type OnboardingMode = "choice" | "photo" | "manual";
type EditorMode = "direct" | "photo-review";
type PhotoAnalysisStage = "idle" | "uploading" | "reading";

const REQUIRED_PHOTO_COUNT = 1;
const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;

function photoAnalysisErrorMessage() {
  return "요금표 사진을 읽지 못했습니다. 다시 시도하거나 뒤로 가서 직접 등록해 주세요.";
}

function AnalyzedPriceGuideEditor({
  document,
  onChange,
  onBack,
  onSave,
  onSaveActionReady,
  onTemporarySave,
  temporarySaveNotice,
}: {
  document: PriceGuideV2;
  onChange: (document: PriceGuideV2) => void;
  onBack: () => void;
  onSave: (document: PriceGuideV2) => Promise<boolean>;
  onSaveActionReady?: (action: (() => Promise<void | boolean>) | null) => void;
  onTemporarySave: (document: PriceGuideV2) => Promise<void>;
  temporarySaveNotice: string;
}) {
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const issues = useMemo(() => validatePriceGuideDocument(document, { photoTable: true }), [document]);

  const saveDraft = useCallback(async () => {
    setValidationAttempted(true);
    setSaveError("");
    if (issues.length > 0) {
      globalThis.requestAnimationFrame(() => globalThis.document.getElementById(issues[0].inputId)?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(document);
      if (!saved) {
        setSaveError("요금표를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
        return;
      }
      setValidationAttempted(false);
      return true;
    } catch {
      setSaveError("요금표를 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다.");
    } finally {
      setSaving(false);
    }
  }, [document, issues, onSave]);

  const saveDraftRef = useRef(saveDraft);
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);
  const registeredSaveAction = useCallback(async () => saveDraftRef.current(), []);
  useEffect(() => {
    onSaveActionReady?.(registeredSaveAction);
    return () => onSaveActionReady?.(null);
  }, [onSaveActionReady, registeredSaveAction]);

  return (
    <section className="min-w-0 space-y-3" data-testid="price-guide-analyzed-editor" data-price-guide-layout="service-columns">
      <div className="flex flex-wrap items-center justify-between gap-2">
      <button type="button" onClick={onBack} className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-2 !text-[14px] !font-medium !leading-5 text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        등록 방식으로 돌아가기
      </button>
      <button type="button" disabled={saving} onClick={() => void onTemporarySave(document)} className="min-h-11 rounded-[10px] border border-[#cbd5e1] bg-white px-4 text-[16px] font-medium leading-6 disabled:opacity-50">임시 저장</button>
      </div>
      {temporarySaveNotice && <p role="status" className="text-[16px] leading-6 text-[#526174]">{temporarySaveNotice}</p>}
      <div className="min-w-0" data-price-guide-horizontal-scroll="native-table">
        <PriceGuideNativeInlineTable
          document={document}
          onChange={(nextDocument) => {
            setSaveError("");
            onChange(nextDocument);
          }}
          validationIssues={validationAttempted ? issues : []}
          heading="분석한 요금표 확인"
          photoReviewMode
        />
      </div>
      {saveError ? <p role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
      <div className="flex flex-wrap gap-3">
      <button type="button" disabled={saving} onClick={() => void onTemporarySave(document)} className="min-h-11 rounded-[10px] border border-[#cbd5e1] bg-white px-5 text-[16px] font-medium leading-6 disabled:opacity-50">임시 저장</button>
      <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#172033] px-5 !text-[16px] !font-medium !leading-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">
        <Check className="h-4 w-4" aria-hidden="true" />
        {saving ? "저장 중" : "상세 요금표 저장"}
      </button>
      </div>
    </section>
  );
}

export default function PriceGuidePhotoOnboarding({
  shopId,
  fixtureMode = false,
  initialDocument = null,
  onApply,
  onSaveActionReady,
}: {
  shopId: string;
  fixtureMode?: boolean;
  initialDocument?: PriceGuideV2 | null;
  onApply: (guide: ServicePriceGuide | PriceGuideV2) => Promise<boolean>;
  onSaveActionReady?: (action: (() => Promise<void | boolean>) | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const photoHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const analysisRunIdRef = useRef(0);
  const pendingCanonicalSaveRef = useRef(false);
  const [mode, setMode] = useState<OnboardingMode>("choice");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisStage, setAnalysisStage] = useState<PhotoAnalysisStage>("idle");
  const [error, setError] = useState("");
  const [supportCode, setSupportCode] = useState<string | null>(null);
  const [manualDocument, setManualDocument] = useState<PriceGuideV2 | null>(() => initialDocument);
  const [editorMode, setEditorMode] = useState<EditorMode>("direct");
  const hasSavedPriceGuide = initialDocument !== null;
  const temporaryDraft = usePriceGuideTemporaryDraft(shopId, fixtureMode);
  const recoveredEditingRef = useRef(false);
  useEffect(() => {
    if (recoveredEditingRef.current || !temporaryDraft.resumeDocument) return;
    recoveredEditingRef.current = true;
    setManualDocument(temporaryDraft.resumeDocument);
    setEditorMode("photo-review");
    setMode("manual");
  }, [temporaryDraft.resumeDocument]);

  useEffect(() => {
    if (mode === "photo") photoHeadingRef.current?.focus();
  }, [mode]);

  useEffect(() => () => {
    analysisRunIdRef.current += 1;
    analysisAbortControllerRef.current?.abort();
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  useEffect(() => {
    if (!pendingCanonicalSaveRef.current || !initialDocument) return;
    pendingCanonicalSaveRef.current = false;
    setManualDocument(initialDocument);
    setEditorMode("direct");
    onSaveActionReady?.(null);
    setMode("choice");
  }, [initialDocument, onSaveActionReady]);

  function clearPhotoTemporaryState() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    setSelectedFile(null);
    setPreviewUrl("");
    setPrivacyConfirmed(false);
    inputRef.current && (inputRef.current.value = "");
  }

  function selectFiles(nextFiles: File[]) {
    if (nextFiles.length === 0) return;
    if (nextFiles.length !== REQUIRED_PHOTO_COUNT) {
      setError("요금표 사진은 한 장만 선택할 수 있습니다.");
      setSupportCode(null);
      return;
    }
    const [nextFile] = nextFiles;
    if (!["image/jpeg", "image/png", "image/webp"].includes(nextFile.type)) {
      setError("JPG, PNG, WebP 사진만 선택할 수 있습니다.");
      setSupportCode(null);
      return;
    }
    if (nextFile.size > MAX_SOURCE_FILE_BYTES) {
      setError("사진이 너무 큽니다. 요금표 사진은 최대 20MB까지 올릴 수 있습니다.");
      setSupportCode(null);
      return;
    }
    const nextPreviewUrl = URL.createObjectURL(nextFile);
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = nextPreviewUrl;
    setSelectedFile(nextFile);
    setPreviewUrl(nextPreviewUrl);
    setPrivacyConfirmed(false);
    setError("");
    setSupportCode(null);
  }

  async function cleanupUploadedAssets(cleanupBindings: PriceGuideUploadCleanupBinding[]) {
    if (fixtureMode || cleanupBindings.length === 0) return;
    await Promise.all(cleanupBindings.map((binding) =>
      cleanupOwnerPriceGuideSourceUpload({ shopId }, binding),
    ));
  }

  function openPhotoReview(nextResult: PriceGuidePhotoImportResponse) {
    setError("");
    setSupportCode(null);
    setManualDocument(nextResult.document);
    void temporaryDraft.rememberEditing(nextResult.document);
    setEditorMode("photo-review");
    clearPhotoTemporaryState();
    setMode("manual");
  }

  async function analyzePhotos() {
    if (!selectedFile || !privacyConfirmed || analyzing || analysisAbortControllerRef.current) return;
    const analysisRunId = analysisRunIdRef.current + 1;
    const requestController = new AbortController();
    const isCurrentAnalysis = () => analysisRunIdRef.current === analysisRunId && !requestController.signal.aborted;
    analysisRunIdRef.current = analysisRunId;
    analysisAbortControllerRef.current = requestController;
    setAnalyzing(true);
    setAnalysisStage("uploading");
    setError("");
    setSupportCode(null);
    const cleanupBindings: PriceGuideUploadCleanupBinding[] = [];
    let lifecycle: Awaited<ReturnType<typeof createOwnerMediaAssetFromFile>>["priceGuideLifecycle"] = null;
    let providerStartedAt = 0;
    try {
      if (fixtureMode) {
        await Promise.resolve();
        setAnalysisStage("reading");
        if (isCurrentAnalysis()) openPhotoReview(createPriceGuidePhotoImportFixture());
        return;
      }
      const upload = await createOwnerMediaAssetFromFile(
        { shopId },
        "price_guide_source",
        selectedFile,
        { createProviderReadyVariant: false },
      );
      if (!upload.priceGuideCleanup) {
        throw new Error("요금표 사진 정리 정보를 확인하지 못했습니다.");
      }
      cleanupBindings.push(upload.priceGuideCleanup);
      lifecycle = upload.priceGuideLifecycle;
      if (!isCurrentAnalysis()) {
        try {
          await cleanupUploadedAssets(cleanupBindings);
        } catch {
          // The server-side purge remains fail-closed; do not surface identifiers after cancellation.
        }
        return;
      }
      setAnalysisStage("reading");
      if (lifecycle) {
        providerStartedAt = performance.now();
        reportPriceGuidePhotoLifecycle({
          requestCorrelationFingerprint: lifecycle.requestCorrelationFingerprint,
          stage: "provider",
          status: "started",
          elapsedMs: providerStartedAt - lifecycle.startedAtMs,
          counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 0 },
        });
      }
      const nextResult = await fetchApiJsonWithAuth<PriceGuidePhotoImportResponse>("/api/owner/price-guide-photo-import", {
        method: "POST",
        credentials: "omit",
        body: JSON.stringify({
          shopId,
          privacyConfirmed: true,
          ...buildPriceGuideHardPurgeRequest(upload.priceGuideCleanup),
        }),
        signal: requestController.signal,
      });
      if (lifecycle) {
        reportPriceGuidePhotoLifecycle({
          requestCorrelationFingerprint: lifecycle.requestCorrelationFingerprint,
          stage: "provider",
          status: "succeeded",
          elapsedMs: performance.now() - providerStartedAt,
          counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
        });
      }
      rememberOwnerPriceGuideHardPurgeReceipt(upload.priceGuideCleanup, nextResult.cleanupReceipt);
      if (!isCurrentAnalysis()) {
        await cleanupLatePhotoAnalysisResult(cleanupBindings, cleanupUploadedAssets);
        return;
      }
      openPhotoReview(nextResult);
    } catch (reason) {
      if (!isCurrentAnalysis()) {
        if (lifecycle && providerStartedAt > 0) {
          reportPriceGuidePhotoLifecycle({
            requestCorrelationFingerprint: lifecycle.requestCorrelationFingerprint,
            stage: "provider",
            status: "aborted",
            elapsedMs: performance.now() - providerStartedAt,
            counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
            failureClass: "aborted",
          });
        }
        try {
          await cleanupUploadedAssets(cleanupBindings);
        } catch {
          // The server-side purge remains fail-closed; do not surface identifiers after cancellation.
        }
        return;
      }
      if (lifecycle && providerStartedAt > 0) {
        reportPriceGuidePhotoLifecycle({
          requestCorrelationFingerprint: lifecycle.requestCorrelationFingerprint,
          stage: "provider",
          status: "failed",
          elapsedMs: performance.now() - providerStartedAt,
          counts: { uploadIntentCount: 1, uploadCount: 1, providerRequestCount: 1, cleanupCount: 1 },
          failureClass: "provider_rejected",
        });
      }
      try {
        await cleanupUploadedAssets(cleanupBindings);
        setError(photoAnalysisErrorMessage());
        setSupportCode(readPriceGuidePhotoSupportCode(reason) ?? lifecycle?.supportCode ?? null);
      } catch (cleanupError) {
        setError(photoAnalysisErrorMessage());
        setSupportCode(readPriceGuidePhotoSupportCode(cleanupError) ?? lifecycle?.supportCode ?? null);
      }
    } finally {
      if (analysisRunIdRef.current === analysisRunId) {
        analysisAbortControllerRef.current = null;
        setAnalyzing(false);
        setAnalysisStage("idle");
      }
    }
  }

  function cancelAnalysis() {
    const requestController = analysisAbortControllerRef.current;
    if (!requestController) return;
    analysisRunIdRef.current += 1;
    requestController.abort();
    analysisAbortControllerRef.current = null;
    setAnalyzing(false);
    setAnalysisStage("idle");
    clearPhotoTemporaryState();
    setError("");
    setSupportCode(null);
    setEditorMode("direct");
    onSaveActionReady?.(null);
    setMode("choice");
  }

  function returnToChoice() {
    void temporaryDraft.clearEditing().catch(() => {});
    clearPhotoTemporaryState();
    setError("");
    setSupportCode(null);
    setEditorMode("direct");
    onSaveActionReady?.(null);
    setMode("choice");
  }

  function selectMode(nextMode: OnboardingMode) {
    onSaveActionReady?.(null);
    if (nextMode === "manual") {
      setManualDocument(initialDocument);
      setEditorMode("direct");
    }
    setMode(nextMode);
  }

  async function applyReviewedDocument(document: PriceGuideV2) {
    pendingCanonicalSaveRef.current = true;
    try {
      const saved = await onApply(document);
      if (saved) await temporaryDraft.clear();
      if (!saved) pendingCanonicalSaveRef.current = false;
      return saved;
    } catch (reason) {
      pendingCanonicalSaveRef.current = false;
      throw reason;
    }
  }

  return (
    <div className="min-w-0 space-y-4" data-testid="price-guide-onboarding" data-price-guide-entry-state={hasSavedPriceGuide && mode === "choice" ? "saved" : mode}>
      {mode === "choice" && temporaryDraft.available && <button type="button" className="min-h-11 rounded-[10px] border border-[#cbd5e1] px-4 text-[16px] font-medium leading-6" onClick={async () => { const draft = await temporaryDraft.restore(); if (draft) { setManualDocument(draft); setEditorMode(draft.source === "manual" ? "direct" : "photo-review"); setMode("manual"); } }}>임시 저장한 요금표 불러오기</button>}
      {mode === "choice" && temporaryDraft.notice && <p role="status" className="text-[16px] leading-6 text-[#526174]">{temporaryDraft.notice}</p>}
      {mode === "choice" && !hasSavedPriceGuide ? <PriceGuideOnboardingChoice onSelect={selectMode} /> : null}

      {mode === "manual" && editorMode === "direct" ? (
        <PriceGuideManualOnboarding
          initialDocument={manualDocument}
          onBack={returnToChoice}
          onSave={applyReviewedDocument}
          onTemporarySave={temporaryDraft.save}
          temporarySaveNotice={temporaryDraft.notice}
          manualMatrixMode
          onSaveActionReady={onSaveActionReady}
        />
      ) : null}

      {mode === "manual" && editorMode === "photo-review" && manualDocument ? (
        <AnalyzedPriceGuideEditor
          document={manualDocument}
          onChange={(document) => { setManualDocument(document); void temporaryDraft.rememberEditing(document); }}
          onBack={returnToChoice}
          onSave={applyReviewedDocument}
          onTemporarySave={temporaryDraft.save}
          temporarySaveNotice={temporaryDraft.notice}
          onSaveActionReady={onSaveActionReady}
        />
      ) : null}

      {mode === "photo" ? <section className="overflow-hidden rounded-[14px] border border-[#d9e2ee] bg-white">
        <header className="flex min-h-16 items-center gap-2 border-b border-[#e8edf3] px-4 py-2 sm:px-5">
          <button type="button" onClick={returnToChoice} disabled={analyzing} aria-label="등록 방식 선택으로 돌아가기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <h3 ref={photoHeadingRef} tabIndex={-1} className="min-w-0 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033] outline-none">사진으로 요금표 만들기</h3>
        </header>
        <div className="p-4 sm:p-5">
        <div className="mx-auto w-full max-w-[680px]" data-price-guide-photo-picker="single">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(event) => {
              selectFiles(Array.from(event.currentTarget.files ?? []));
              event.currentTarget.value = "";
            }}
          />
          {selectedFile && previewUrl ? (
            <div className="overflow-hidden rounded-[12px] border border-[#dce3eb] bg-white" data-price-guide-photo-preview="selected">
              <div className="relative h-[144px] bg-[#f3f5f8] sm:h-[160px]">
                <Image
                  src={previewUrl}
                  alt="선택한 요금표 사진"
                  fill
                  sizes="(max-width: 680px) 100vw, 680px"
                  unoptimized
                  className="object-contain p-2"
                />
              </div>
              <div className="flex min-h-11 items-center justify-between gap-3 border-t border-[#e5eaf0] px-3">
                <span className="text-[13px] font-normal leading-5 text-[#607080]">요금표 사진 1장</span>
                <button type="button" onClick={() => inputRef.current?.click()} disabled={analyzing} className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-[8px] px-3 !text-[14px] !font-medium !leading-5 text-[#334155] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60">사진 바꾸기</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => inputRef.current?.click()} disabled={analyzing} className="flex min-h-[128px] w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-[#9fbcf0] bg-[#f7faff] px-5 text-center transition hover:bg-[#f2f7ff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" data-price-guide-photo-picker-state="empty">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e5efff] text-[#2563eb]"><ImagePlus className="h-5 w-5" aria-hidden="true" /></span>
              <span className="mt-2 text-[16px] font-medium leading-6 text-[#1d4f9e]">요금표 사진 선택</span>
              <span className="mt-1 text-[12px] font-normal leading-[18px] text-[#6b7f9f]">JPG, PNG, WebP · 1장 · 최대 20MB</span>
            </button>
          )}

          {selectedFile ? (
            <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 rounded-[9px] border border-[#dce3eb] bg-white px-3 py-2.5 text-[14px] font-medium leading-5 text-[#42536a]">
              <input
                type="checkbox"
                checked={privacyConfirmed}
                onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                disabled={analyzing}
                className="mt-0.5 h-5 w-5 rounded border-[#aab7c7] accent-[#172033]"
              />
              <span>사진에 이름·전화번호·주소가 없음을 확인했습니다.</span>
            </label>
          ) : null}
          {error ? (
            <div className="mt-3 text-[13px] font-medium leading-5 text-[#a04455]" role="alert">
              <p>{error}</p>
              {supportCode ? <p className="mt-1 font-normal text-[#64748b]">문의 코드: {supportCode}</p> : null}
            </div>
          ) : null}
          <div className="mt-4">
            <button type="button" onClick={() => void analyzePhotos()} disabled={!selectedFile || !privacyConfirmed || analyzing} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] bg-[#172033] px-5 !text-[16px] !font-medium !leading-6 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">
              {analyzing ? <><LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />요금표 불러오는 중</> : "요금표 불러오기"}
            </button>
          </div>
          {analyzing ? (
            <p className="mt-2 text-center text-[13px] font-normal leading-5 text-[#607080]" role="status" aria-live="polite">
              {analysisStage === "uploading" ? "사진을 안전하게 준비하고 있어요." : "사진 속 표의 행과 열을 읽고 있어요."}
            </p>
          ) : null}
          {analyzing ? <button type="button" onClick={cancelAnalysis} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-4 !text-[14px] !font-medium !leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">불러오기 취소</button> : null}
        </div>
        </div>
      </section> : null}

      {mode === "choice" && initialDocument ? (
        <div data-price-guide-source="saved">
          <PriceGuideV2ServiceDetail
            document={initialDocument}
            onSave={applyReviewedDocument}
            manualMatrixMode={isFixedManualPriceGuideDocument(initialDocument)}
            onSaveActionReady={onSaveActionReady}
          />
        </div>
      ) : null}
    </div>
  );
}
