"use client";

import Image from "next/image";
import { AlertTriangle, Camera, Check, FileSpreadsheet, ImagePlus, LoaderCircle, PencilLine, ShieldCheck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import DataImportDialog from "@/components/owner-web/data-import-dialog";
import type { ServicePriceGuide } from "@/components/owner-web/service-price-guide";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerMediaAssetFromFile } from "@/lib/media/owner-media-client";
import { cn } from "@/lib/utils";
import type { PriceGuidePhotoImportResponse } from "@/types/price-guide-photo-import";

type OnboardingMode = "choice" | "photo" | "manual" | "hidden";

const MAX_PHOTO_COUNT = 5;
const MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;

function formatCellValue(price: string, durationMinutes: string) {
  const priceLabel = price ? `${Number(price.replace(/[^0-9]/g, "")).toLocaleString("ko-KR")}원${price.includes("~") ? "~" : ""}` : "가격 확인 필요";
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
  onApply,
}: {
  shopId: string;
  onApply: (guide: ServicePriceGuide) => Promise<boolean>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<OnboardingMode>("choice");
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [result, setResult] = useState<PriceGuidePhotoImportResponse | null>(null);
  const [uploadedMediaAssetIds, setUploadedMediaAssetIds] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [excelOpen, setExcelOpen] = useState(false);

  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviewUrls(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  if (mode === "hidden") return null;

  function selectFiles(nextFiles: File[]) {
    const imageFiles = nextFiles.filter((file) => file.type.startsWith("image/"));
    const oversized = imageFiles.find((file) => file.size > MAX_SOURCE_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} 파일이 너무 큽니다. 사진 한 장은 최대 20MB까지 올릴 수 있습니다.`);
      return;
    }
    setFiles(imageFiles.slice(0, MAX_PHOTO_COUNT));
    setUploadedMediaAssetIds([]);
    setResult(null);
    setError(imageFiles.length > MAX_PHOTO_COUNT ? "요금표 사진은 최대 5장까지 분석합니다." : "");
  }

  async function analyzePhotos() {
    if (files.length === 0 || analyzing) return;
    setAnalyzing(true);
    setError("");
    try {
      const mediaAssetIds = [...uploadedMediaAssetIds];
      for (const file of files.slice(mediaAssetIds.length)) {
        const uploaded = await createOwnerMediaAssetFromFile(
          { shopId },
          "price_guide_source",
          file,
          { createProviderReadyVariant: false },
        );
        mediaAssetIds.push(uploaded.mediaAsset.id);
        setUploadedMediaAssetIds([...mediaAssetIds]);
      }
      const nextResult = await fetchApiJsonWithAuth<PriceGuidePhotoImportResponse>("/api/owner/price-guide-photo-import", {
        method: "POST",
        body: JSON.stringify({ shopId, mediaAssetIds }),
      });
      setResult(nextResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "요금표 사진을 분석하지 못했습니다.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function applyResult() {
    if (!result || applying) return;
    setApplying(true);
    setError("");
    try {
      const saved = await onApply(result.guide);
      if (!saved) {
        setError("요금표 저장에 실패했습니다. 아래 입력값을 확인한 뒤 다시 시도해 주세요.");
        return;
      }
      setMode("manual");
    } finally {
      setApplying(false);
    }
  }

  if (mode === "manual") {
    return (
      <div className="rounded-[12px] border border-[#cfe0ff] bg-[#f5f9ff] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-semibold text-[#245bd0]">직접 입력 모드</p>
            <p className="mt-1 text-[12px] leading-5 text-[#4b6280]">아래 상세 요금표에 현재 매장 기준을 입력해 주세요. 언제든 사진 자동 등록으로 돌아올 수 있습니다.</p>
          </div>
          <button type="button" onClick={() => setMode("photo")} className="shrink-0 rounded-[8px] border border-[#bdd2f5] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#245bd0]">사진으로 등록</button>
        </div>
      </div>
    );
  }

  return (
    <>
      <section className="overflow-hidden rounded-[14px] border border-[#c9d9f5] bg-white shadow-[0_10px_30px_rgba(37,99,235,0.07)]">
        <div className="border-b border-[#dbe6f8] bg-[linear-gradient(135deg,#f4f8ff_0%,#ffffff_65%)] px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-flex h-6 items-center rounded-full bg-[#2563eb] px-2.5 text-[11px] font-semibold text-white">가장 빠른 시작</span>
              <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em] text-[#111827]">사용 중인 요금표를 사진으로 올려주세요</h3>
              <p className="mt-1.5 text-[13px] leading-5 text-[#526174]">사진에 있는 내용을 그대로 옮기고, 읽기 어려운 부분만 확인 필요로 표시합니다.</p>
            </div>
            <button type="button" onClick={() => setMode("hidden")} className="inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#718096] hover:bg-white" aria-label="나중에 설정"><X className="h-4 w-4" /></button>
          </div>
        </div>

        {mode === "choice" ? (
          <div className="grid gap-3 p-5 lg:grid-cols-[1.35fr_1fr_1fr]">
            <button type="button" onClick={() => setMode("photo")} className="group rounded-[12px] border border-[#9fbcf0] bg-[#f6f9ff] p-4 text-left transition hover:border-[#2563eb] hover:bg-[#f1f6ff]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#2563eb] text-white"><Camera className="h-5 w-5" /></span>
              <p className="mt-3 text-[16px] font-semibold text-[#163f89]">요금표 사진으로 자동 등록</p>
              <p className="mt-1 text-[12px] leading-5 text-[#58709b]">종이, 메뉴판, 휴대폰 화면 모두 가능 · 최대 5장</p>
            </button>
            <button type="button" onClick={() => setExcelOpen(true)} className="rounded-[12px] border border-[#dce3eb] bg-white p-4 text-left transition hover:border-[#aebdce] hover:bg-[#fbfcfd]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef2f7] text-[#526174]"><FileSpreadsheet className="h-5 w-5" /></span>
              <p className="mt-3 text-[15px] font-semibold text-[#334155]">엑셀·파일에서 가져오기</p>
              <p className="mt-1 text-[12px] leading-5 text-[#718096]">티피 또는 일반 엑셀 파일 이전</p>
            </button>
            <button type="button" onClick={() => setMode("manual")} className="rounded-[12px] border border-[#dce3eb] bg-white p-4 text-left transition hover:border-[#aebdce] hover:bg-[#fbfcfd]">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] bg-[#eef2f7] text-[#526174]"><PencilLine className="h-5 w-5" /></span>
              <p className="mt-3 text-[15px] font-semibold text-[#334155]">직접 입력하기</p>
              <p className="mt-1 text-[12px] leading-5 text-[#718096]">아래 상세 요금표를 직접 수정</p>
            </button>
          </div>
        ) : (
          <div className="p-5">
            {!result ? (
              <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
                <div>
                  <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
                  <button type="button" onClick={() => inputRef.current?.click()} className="flex min-h-[210px] w-full flex-col items-center justify-center rounded-[12px] border border-dashed border-[#9fbcf0] bg-[#f7faff] px-5 text-center transition hover:bg-[#f2f7ff]">
                    <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#e5efff] text-[#2563eb]"><ImagePlus className="h-6 w-6" /></span>
                    <span className="mt-3 text-[15px] font-semibold text-[#1d4f9e]">요금표 사진 선택</span>
                    <span className="mt-1 text-[12px] leading-5 text-[#6b7f9f]">JPG, PNG, WebP · 최대 5장<br />한 장당 최대 20MB</span>
                  </button>
                </div>
                <div className="min-w-0">
                  {previewUrls.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {previewUrls.map((url, index) => (
                        <div key={url} className="relative aspect-[4/3] overflow-hidden rounded-[9px] border border-[#dce3eb] bg-[#f3f5f8]">
                          <Image src={url} alt={`요금표 원본 ${index + 1}`} fill sizes="180px" unoptimized className="object-cover" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[150px] items-center justify-center rounded-[10px] border border-[#e5e9ef] bg-[#fbfcfd] px-4 text-center">
                      <p className="text-[13px] leading-6 text-[#718096]">표 전체가 정면으로 보이게 찍으면 더 정확합니다.<br />여러 장이면 겹치는 부분이 있어도 자동으로 정리합니다.</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-start gap-2 rounded-[9px] bg-[#f7f9fc] px-3 py-2.5">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#2563eb]" />
                    <p className="text-[11px] leading-5 text-[#607080]">사진은 매장 전용 비공개 원본으로 보관됩니다. AI 분석 후에도 자동 저장하지 않으며, 오너가 결과를 확인해야 요금표에 반영됩니다.</p>
                  </div>
                  {error ? <p className="mt-3 text-[12px] font-medium text-[#a04455]">{error}</p> : null}
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button type="button" onClick={() => setMode("choice")} disabled={analyzing} className="h-10 rounded-[8px] border border-[#dce3eb] px-4 text-[13px] font-medium text-[#526174]">다른 방법 선택</button>
                    <button type="button" onClick={() => void analyzePhotos()} disabled={files.length === 0 || analyzing} className="inline-flex h-10 min-w-[180px] items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-45">
                      {analyzing ? <><LoaderCircle className="h-4 w-4 animate-spin" />사진 읽는 중...</> : "사진 내용 자동으로 옮기기"}
                    </button>
                  </div>
                </div>
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
                  <button type="button" onClick={() => { setResult(null); setError(""); }} className="mt-3 h-9 w-full rounded-[8px] border border-[#dce3eb] text-[12px] font-medium text-[#526174]">사진 다시 선택</button>
                </div>
                <div>
                  <ExtractionPreview result={result} />
                  {error ? <p className="mt-3 text-[12px] font-medium text-[#a04455]">{error}</p> : null}
                  <div className="mt-4 flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setResult(null); setMode("manual"); }} disabled={applying} className="h-10 rounded-[8px] border border-[#dce3eb] px-4 text-[13px] font-medium text-[#526174] disabled:opacity-50">직접 입력으로 전환</button>
                    <button type="button" onClick={() => void applyResult()} disabled={applying} className="inline-flex h-10 items-center gap-2 rounded-[8px] bg-[#2563eb] px-5 text-[13px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{applying ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}{applying ? "저장 중..." : "확인하고 요금표에 저장"}</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
      <DataImportDialog
        open={excelOpen}
        shopId={shopId}
        onClose={() => setExcelOpen(false)}
        onCompleted={() => window.location.reload()}
      />
    </>
  );
}
