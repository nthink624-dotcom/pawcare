"use client";

import Image from "next/image";
import { AlertTriangle, ArrowLeft, Camera, Check, ImagePlus, LoaderCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import PriceGuideManualOnboarding, { createEmptyManualPriceGuideDocument } from "@/components/owner-web/price-guide-manual-onboarding";
import PriceGuideOnboardingChoice from "@/components/owner-web/price-guide-onboarding-choice";
import PriceGuideV2ServiceDetail, { isFixedManualPriceGuideDocument } from "@/components/owner-web/price-guide-v2-service-detail";
import type { ServicePriceGuide } from "@/components/owner-web/service-price-guide";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import { cleanupLatePhotoAnalysisResult } from "@/lib/price-guide-photo-analysis-client";
import { createPriceGuidePhotoImportFixture } from "@/lib/price-guide-photo-import-fixture";
import { cn } from "@/lib/utils";
import type { PriceGuidePhotoImportResponse, PriceGuideV2 } from "@/types/price-guide-photo-import";

type OnboardingMode = "choice" | "photo" | "manual";
type EditorMode = "direct" | "photo-review";

const MAX_PHOTO_COUNT = 5;
const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;

function formatCellValue(price: string, durationMinutes: string) {
  const [minimum = "", maximum = ""] = price.trim().split("~", 2);
  const formatPrice = (value: string) => {
    const digits = value.replace(/[^0-9]/g, "");
    return digits ? Number(digits).toLocaleString("ko-KR") : value.trim();
  };
  const priceLabel = !price.trim()
    ? "가격 확인 필요"
    : price.includes("~")
      ? maximum.trim()
        ? `${formatPrice(minimum)}~${formatPrice(maximum)}원`
        : `${formatPrice(minimum)}원~`
      : `${formatPrice(minimum)}원`;
  return durationMinutes ? `${priceLabel} · ${durationMinutes}분` : priceLabel;
}

function ExtractionPreview({ result }: { result: PriceGuidePhotoImportResponse }) {
  const issuePaths = new Set(result.issues.map((issue) => issue.path));
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[16px] font-semibold text-[#172033]">사진에서 옮긴 내용</p>
          <p className="mt-1 text-[13px] text-[#64748b]">원본과 비교해 노란 표시가 있는 항목만 확인해 주세요.</p>
        </div>
        <span className={cn(
          "inline-flex h-7 items-center rounded-full border px-2.5 text-[12px] font-medium",
          result.issues.length > 0 ? "border-[#f0d6a7] bg-[#fff9ed] text-[#98691e]" : "border-[#c9e4d7] bg-[#f2fbf7] text-[#237253]",
        )}>
          {result.issues.length > 0 ? `확인 필요 ${result.issues.length}개` : "모두 선명하게 인식됨"}
        </span>
      </div>

      <div className="max-h-[430px] space-y-3 overflow-auto pr-1">
        {(result.guide.sections ?? []).map((section) => (
          <section key={section.id} className="overflow-hidden rounded-[10px] border border-[#e2e8f0] bg-white">
            <div className="border-b border-[#e8edf3] bg-[#f8fafc] px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-[#eaf2ff] px-2 py-0.5 text-[11px] font-semibold text-[#2563b8]">
                  {section.species === "cat" ? "고양이" : "강아지"}
                </span>
                <p className="text-[14px] font-semibold text-[#172033]">{section.title}</p>
              </div>
              {section.note ? <p className="mt-1 text-[12px] text-[#718096]">{section.note}</p> : null}
            </div>
            <div className="divide-y divide-[#eef2f6]">
              {section.items.map((item) => (
                <div key={item.id} className="px-3.5 py-2.5">
                  <p className="text-[13px] font-semibold text-[#334155]">{item.label}</p>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {section.weightBands.map((weightBand) => {
                      const cell = item.cells[weightBand];
                      const path = `${section.title} / ${item.label} / ${weightBand}`;
                      const needsReview = issuePaths.has(path);
                      return (
                        <div key={weightBand} className={cn(
                          "flex items-center justify-between gap-2 rounded-[7px] border px-2.5 py-2 text-[12px]",
                          needsReview ? "border-[#efd7ad] bg-[#fffaf0]" : "border-[#e8edf3] bg-[#fbfcfd]",
                        )}>
                          <span className="text-[#64748b]">{weightBand}</span>
                          <span className={cn("text-right font-medium", needsReview ? "text-[#996a22]" : "text-[#253044]")}>{formatCellValue(cell?.price ?? "", cell?.durationMinutes ?? "")}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
        {result.guide.extraFees.length > 0 ? (
          <section className="rounded-[10px] border border-[#e2e8f0] bg-white px-3.5 py-3">
            <p className="text-[13px] font-semibold text-[#334155]">추가요금</p>
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {result.guide.extraFees.map((fee) => {
                const needsReview = issuePaths.has(`추가요금 / ${fee.label}`);
                return (
                  <div key={fee.id} className={cn(
                    "flex items-center justify-between gap-2 rounded-[7px] border px-2.5 py-2 text-[12px]",
                    needsReview ? "border-[#efd7ad] bg-[#fffaf0]" : "border-[#e8edf3] bg-[#fbfcfd]",
                  )}>
                    <span className="text-[#64748b]">{fee.label}</span>
                    <span className={cn("font-medium", needsReview ? "text-[#996a22]" : "text-[#253044]")}>{formatCellValue(fee.price, "")}</span>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}
        {result.guide.extraNote ? (
          <section className="rounded-[10px] border border-[#e2e8f0] bg-[#fbfcfd] px-3.5 py-3">
            <p className="text-[12px] font-semibold text-[#526174]">요금표 안내 문구</p>
            <p className="mt-1 whitespace-pre-wrap text-[12px] leading-5 text-[#64748b]">{result.guide.extraNote}</p>
          </section>
        ) : null}
      </div>

      {result.issues.length > 0 ? (
        <div className="rounded-[9px] border border-[#efd7ad] bg-[#fffaf0] px-3 py-2.5">
          <p className="flex items-center gap-1.5 text-[12px] font-semibold text-[#8a5c17]"><AlertTriangle className="h-4 w-4" />확인이 필요한 부분</p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-[#8a6734]">
            {result.issues.slice(0, 8).map((issue, index) => <li key={`${issue.path}-${index}`}>· {issue.path}: {issue.message}</li>)}
            {result.issues.length > 8 ? <li>· 그 외 {result.issues.length - 8}개는 아래 상세 요금표에서 확인해 주세요.</li> : null}
          </ul>
        </div>
      ) : null}
    </div>
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
  onSaveActionReady?: (action: (() => Promise<void>) | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const captureRef = useRef<HTMLInputElement | null>(null);
  const photoHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const analysisAbortControllerRef = useRef<AbortController | null>(null);
  const analysisRunIdRef = useRef(0);
  const [mode, setMode] = useState<OnboardingMode>("choice");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [result, setResult] = useState<PriceGuidePhotoImportResponse | null>(null);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [manualDocument, setManualDocument] = useState<PriceGuideV2 | null>(() => initialDocument);
  const [editorMode, setEditorMode] = useState<EditorMode>("direct");
  const displayedDocument = useMemo(
    () => initialDocument ?? createEmptyManualPriceGuideDocument(),
    [initialDocument],
  );

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  useEffect(() => {
    if (mode === "photo") photoHeadingRef.current?.focus();
  }, [mode]);

  useEffect(() => () => {
    analysisRunIdRef.current += 1;
    analysisAbortControllerRef.current?.abort();
  }, []);

  function clearPhotoTemporaryState() {
    setFiles([]);
    setPrivacyConfirmed(false);
    setResult(null);
    inputRef.current && (inputRef.current.value = "");
    captureRef.current && (captureRef.current.value = "");
  }

  function selectFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => ["image/jpeg", "image/png", "image/webp"].includes(file.type));
    const oversized = imageFiles.find((file) => file.size > MAX_SOURCE_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} 파일이 너무 큽니다. 사진 한 장은 최대 20MB까지 올릴 수 있습니다.`);
      return;
    }
    setFiles(imageFiles.slice(0, MAX_PHOTO_COUNT));
    setPrivacyConfirmed(false);
    setResult(null);
    setError(
      imageFiles.length === 0 && nextFiles.length > 0
        ? "JPG, PNG, WebP 사진만 선택할 수 있습니다."
        : imageFiles.length > MAX_PHOTO_COUNT
          ? "요금표 사진은 최대 5장까지 분석합니다."
          : "",
    );
  }

  async function cleanupUploadedAssets(mediaAssetIds: string[]) {
    if (fixtureMode || mediaAssetIds.length === 0) return;
    try {
      await fetchApiJsonWithAuth("/api/owner/price-guide-photo-import", {
        method: "DELETE",
        body: JSON.stringify({ shopId, mediaAssetIds }),
      });
    } catch {
      // Source uploads use transient retention as a second cleanup boundary.
    }
  }

  async function analyzePhotos() {
    if (files.length === 0 || !privacyConfirmed || analyzing || analysisAbortControllerRef.current) return;
    const analysisRunId = analysisRunIdRef.current + 1;
    const requestController = new AbortController();
    const isCurrentAnalysis = () => analysisRunIdRef.current === analysisRunId && !requestController.signal.aborted;
    analysisRunIdRef.current = analysisRunId;
    analysisAbortControllerRef.current = requestController;
    setAnalyzing(true);
    setError("");
    const mediaAssetIds: string[] = [];
    try {
      if (fixtureMode) {
        await Promise.resolve();
        if (isCurrentAnalysis()) setResult(createPriceGuidePhotoImportFixture());
        return;
      }
      const uploads = await Promise.allSettled(files.map((file) =>
        createOwnerMediaAssetFromFile(
          { shopId },
          "price_guide_source",
          file,
          { createProviderReadyVariant: false },
        ),
      ));
      mediaAssetIds.push(...uploads.flatMap((upload) =>
        upload.status === "fulfilled" ? [upload.value.mediaAsset.id] : [],
      ));
      const failedUpload = uploads.find((upload) => upload.status === "rejected");
      if (failedUpload?.status === "rejected") throw failedUpload.reason;
      if (!isCurrentAnalysis()) {
        await cleanupUploadedAssets(mediaAssetIds);
        return;
      }
      const nextResult = await fetchApiJsonWithAuth<PriceGuidePhotoImportResponse>("/api/owner/price-guide-photo-import", {
        method: "POST",
        body: JSON.stringify({ shopId, mediaAssetIds, privacyConfirmed: true }),
        signal: requestController.signal,
      });
      if (!isCurrentAnalysis()) {
        await cleanupLatePhotoAnalysisResult(mediaAssetIds, cleanupUploadedAssets);
        return;
      }
      setResult(nextResult);
    } catch (reason) {
      if (!isCurrentAnalysis()) {
        await cleanupUploadedAssets(mediaAssetIds);
        return;
      }
      await cleanupUploadedAssets(mediaAssetIds);
      setError(reason instanceof Error ? reason.message : "요금표 사진을 분석하지 못했습니다.");
    } finally {
      if (analysisRunIdRef.current === analysisRunId) {
        analysisAbortControllerRef.current = null;
        setAnalyzing(false);
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
    clearPhotoTemporaryState();
    setError("분석을 취소했습니다. 사진을 다시 선택해 주세요.");
  }

  function reviewResult() {
    if (!result) return;
    setError("");
    setManualDocument(result.document);
    setEditorMode("photo-review");
    setResult(null);
    setMode("manual");
  }

  function selectMode(nextMode: OnboardingMode) {
    if (nextMode === "manual") {
      setManualDocument(initialDocument);
      setEditorMode("direct");
    }
    setMode(nextMode);
  }

  async function applyReviewedDocument(document: PriceGuideV2) {
    const saved = await onApply(document);
    if (saved) setManualDocument(document);
    return saved;
  }

  return (
    <div className="min-w-0 space-y-4" data-testid="price-guide-onboarding">
      <PriceGuideOnboardingChoice onSelect={selectMode} />

      {mode === "manual" ? (
        <PriceGuideManualOnboarding
          initialDocument={manualDocument}
          onBack={() => {
            setEditorMode("direct");
            setMode("choice");
          }}
          onSave={applyReviewedDocument}
          manualMatrixMode={editorMode === "direct"}
          onSaveActionReady={onSaveActionReady}
        />
      ) : null}

      {mode === "photo" ? <section className="overflow-hidden rounded-[14px] border border-[#d9e2ee] bg-white">
      <header className="border-b border-[#e8edf3] px-4 py-4 sm:px-5">
        <button type="button" onClick={() => setMode("choice")} disabled={analyzing} className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-2 text-[13px] font-medium text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:opacity-50">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          다른 방법 선택
        </button>
        <h3 ref={photoHeadingRef} tabIndex={-1} className="mt-1 text-[20px] font-semibold tracking-[-0.025em] text-[#172033] outline-none">사진으로 요금표 만들기</h3>
      </header>
      <div className="p-4 sm:p-5">
            {!result ? (
              <div className={previewUrls.length > 0 ? "grid gap-4 lg:grid-cols-[360px_1fr]" : "w-full"}>
                <div className={previewUrls.length > 0 ? undefined : "mx-auto w-full max-w-[640px]"}>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
                  <input ref={captureRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
                  <button type="button" onClick={() => inputRef.current?.click()} disabled={analyzing} className="flex min-h-[210px] w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-[#9fbcf0] bg-[#f7faff] px-5 text-center transition hover:bg-[#f2f7ff] disabled:cursor-not-allowed disabled:opacity-60">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e5efff] text-[#2563eb]"><ImagePlus className="h-6 w-6" /></span>
                    <span className="mt-3 text-[15px] font-semibold text-[#1d4f9e]">요금표 사진 선택</span>
                    <span className="mt-1 text-[12px] leading-5 text-[#6b7f9f]">JPG, PNG, WebP · 최대 5장<br />한 장당 최대 20MB</span>
                  </button>
                  <button type="button" onClick={() => captureRef.current?.click()} disabled={analyzing} className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[8px] border border-[#dce3eb] bg-white px-4 text-[13px] font-medium text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60">
                    <Camera className="h-4 w-4" aria-hidden="true" />
                    카메라로 촬영
                  </button>
                  {previewUrls.length === 0 ? <p className="mt-3 text-[11px] leading-5 text-[#607080]">OpenAI 분석 전 사진에서 이름·전화번호·주소를 가려 주세요.</p> : null}
                </div>
                {previewUrls.length > 0 && (
                  <div className="min-w-0">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {previewUrls.map((url, index) => (
                        <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-[9px] border border-[#dce3eb] bg-[#f3f5f8]">
                          <Image src={url} alt={`요금표 원본 ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                  <p className="mt-3 text-[11px] leading-5 text-[#607080]">OpenAI 분석 전 사진에서 이름·전화번호·주소를 가려 주세요.</p>
                  <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-2 rounded-[9px] border border-[#dce3eb] bg-white px-3 py-2.5 text-[13px] font-medium leading-5 text-[#42536a]">
                      <input
                        type="checkbox"
                        checked={privacyConfirmed}
                        onChange={(event) => setPrivacyConfirmed(event.target.checked)}
                        disabled={analyzing}
                        className="mt-0.5 h-5 w-5 rounded border-[#aab7c7] accent-[#172033]"
                      />
                      <span>표 가운데에 사람 이름·전화번호·주소가 없는 것을 확인했습니다.</span>
                    </label>
                  {error ? <p className="mt-3 text-[12px] font-medium text-[#a04455]">{error}</p> : null}
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <button type="button" onClick={() => selectMode("manual")} disabled={analyzing} className="min-h-11 rounded-[8px] border border-[#dce3eb] px-4 text-[13px] font-medium text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] disabled:cursor-not-allowed disabled:opacity-60">사진 없이 직접 입력</button>
                    <button type="button" onClick={() => void analyzePhotos()} disabled={files.length === 0 || !privacyConfirmed || analyzing} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] bg-[#172033] px-5 text-[13px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45">
                      {analyzing ? <><LoaderCircle className="h-4 w-4 animate-spin" />사진 읽는 중...</> : error ? "다시 분석하기" : "사진 내용 자동으로 옮기기"}
                    </button>
                  </div>
                  {analyzing ? <button type="button" onClick={cancelAnalysis} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">분석 취소</button> : null}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
                <div>
                  <p className="text-[16px] font-semibold text-[#172033]">등록한 원본 사진</p>
                  <p className="mt-1 text-[13px] text-[#64748b]">추출 결과와 나란히 비교해 주세요.</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {previewUrls.map((url, index) => (
                      <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-[9px] border border-[#dce3eb] bg-[#f3f5f8]">
                        <Image src={url} alt={`요금표 원본 ${index + 1}`} fill sizes="170px" unoptimized className="object-cover" />
                      </div>
                    ))}
                  </div>
                  <button type="button" onClick={() => { clearPhotoTemporaryState(); setError(""); }} className="mt-3 min-h-11 w-full rounded-[8px] border border-[#dce3eb] text-[12px] font-medium text-[#526174] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2">사진 다시 선택</button>
                </div>
                <div>
                  <ExtractionPreview result={result} />
                  {error ? <p className="mt-3 text-[12px] font-medium text-[#a04455]">{error}</p> : null}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => selectMode("manual")} className="min-h-11 rounded-[8px] border border-[#dce3eb] px-4 text-[13px] font-medium text-[#526174] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]">사진 없이 직접 입력</button>
                    <button type="button" onClick={reviewResult} className="inline-flex min-h-11 items-center gap-2 rounded-[8px] bg-[#172033] px-5 text-[13px] font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"><Check className="h-4 w-4" />검토하고 수정하기</button>
                  </div>
                </div>
              </div>
            )}
      </div>
    </section> : null}

      {mode !== "manual" ? (
        <div data-price-guide-source={initialDocument ? "saved" : "default-draft"}>
          <PriceGuideV2ServiceDetail
            document={displayedDocument}
            onSave={applyReviewedDocument}
            manualMatrixMode={isFixedManualPriceGuideDocument(displayedDocument)}
            onSaveActionReady={onSaveActionReady}
          />
        </div>
      ) : null}
    </div>
  );
}
