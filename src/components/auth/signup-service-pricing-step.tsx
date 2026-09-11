"use client";

import Image from "next/image";
import { ArrowLeft, ArrowRight, Camera, FileImage, ImagePlus, Loader2, PencilLine, ShieldCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import SignupPriceGuideEditor, {
  validatePriceGuideDocument,
  type PriceGuideValidationIssue,
} from "@/components/auth/signup-price-guide-editor";
import {
  buildPriceGuideV2Compatibility,
  buildPriceGuideV2FromLegacySignupServices,
  signupPriceGuideReviewCopy,
  type SignupServicePrice,
} from "@/lib/auth/signup-service-pricing";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

type RecognitionState = "idle" | "loading" | "ready" | "unavailable" | "failed" | "manual";
type AnalysisAccess = { token: string; deviceFingerprint: string };

export function createManualPriceGuideDocument(): PriceGuideV2 {
  return {
    schemaVersion: 2,
    source: "manual",
    overallNote: null,
    rows: [{
      serviceName: null,
      species: "dog",
      breedNames: [],
      breedGroup: null,
      sizeClass: "unknown",
      minKg: null,
      maxKg: null,
      priceKind: "unknown",
      priceMinKrw: null,
      priceMaxKrw: null,
      durationMinutes: null,
      note: null,
    }],
    surcharges: [],
    aiReview: [],
  };
}

function getDeviceFingerprint() {
  const key = "pm_signup_price_guide_device";
  const existing = window.sessionStorage.getItem(key);
  if (existing) return existing;
  const created = crypto.randomUUID().replaceAll("-", "");
  window.sessionStorage.setItem(key, created);
  return created;
}

function focusValidationIssue(issue: PriceGuideValidationIssue) {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(issue.inputId);
    target?.focus();
    target?.scrollIntoView({ behavior: "smooth", block: "center" });
  });
}

export default function SignupServicePricingStep({
  document: controlledDocument,
  onDocumentChange,
  services = [],
  onChange,
  onBack,
  onNext,
  fixtureId,
}: {
  document?: PriceGuideV2 | null;
  onDocumentChange?: (document: PriceGuideV2) => void;
  /** @deprecated Compatibility for the older secure fixture preview only. */
  services?: SignupServicePrice[];
  /** @deprecated Compatibility for the older secure fixture preview only. */
  onChange?: (services: SignupServicePrice[]) => void;
  onBack: () => void;
  onNext: () => void;
  fixtureId?: "korean-price-guide-v1";
}) {
  const [internalDocument, setInternalDocument] = useState<PriceGuideV2 | null>(() => {
    if (controlledDocument !== undefined) return controlledDocument;
    return services.length > 0 ? buildPriceGuideV2FromLegacySignupServices(services, "legacy") : null;
  });
  const priceGuideDocument = controlledDocument === undefined ? internalDocument : controlledDocument;
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<RecognitionState>(() => priceGuideDocument ? (priceGuideDocument.source === "manual" ? "manual" : "ready") : "idle");
  const [message, setMessage] = useState<string | null>(() => priceGuideDocument ? signupPriceGuideReviewCopy.supporting : null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysisAccess, setAnalysisAccess] = useState<AnalysisAccess | null>(null);
  const [purging, setPurging] = useState(false);
  const [validationIssues, setValidationIssues] = useState<PriceGuideValidationIssue[]>([]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  useEffect(() => {
    if (!analysisAccess) return;
    const abandon = () => {
      void fetch("/api/auth/signup/price-guide-preview?reason=abandoned", {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${analysisAccess.token}`,
          "X-PM-Device-Fingerprint": analysisAccess.deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
        keepalive: true,
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", abandon);
    return () => window.removeEventListener("pagehide", abandon);
  }, [analysisAccess, fixtureId]);

  const commitDocument = (next: PriceGuideV2) => {
    setValidationIssues([]);
    if (controlledDocument === undefined) setInternalDocument(next);
    onDocumentChange?.(next);
    onChange?.(buildPriceGuideV2Compatibility(next).services);
  };

  const purgeAnalysis = async (reason: "confirmed" | "cancelled" | "retake" | "manual") => {
    if (!analysisAccess) return true;
    setPurging(true);
    try {
      const response = await fetch(`/api/auth/signup/price-guide-preview?reason=${reason}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${analysisAccess.token}`,
          "X-PM-Device-Fingerprint": analysisAccess.deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => ({}))) as { message?: string };
        setMessage(result.message ?? "사진 분석 임시정보를 정리하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return false;
      }
      setAnalysisAccess(null);
      return true;
    } catch {
      setMessage("사진 분석 임시정보를 정리하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.");
      return false;
    } finally {
      setPurging(false);
    }
  };

  const startManual = async () => {
    if (!(await purgeAnalysis("manual"))) return;
    setState("manual");
    setMessage("사진을 보면서 직접 입력할 수 있어요. 모르는 가격과 시간은 임의로 채우지 않습니다.");
    commitDocument(createManualPriceGuideDocument());
  };

  const analyze = async (file: File | null) => {
    if (!file) return;
    if (!(await purgeAnalysis("retake"))) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setFileName(file.name);
    setState("loading");
    setMessage("사진을 판독하고 있어요. 원본은 서버나 Storage에 저장하지 않습니다.");
    const formData = new FormData();
    formData.set("file", file);
    try {
      const deviceFingerprint = getDeviceFingerprint();
      const tokenResponse = await fetch("/api/auth/signup/price-guide-token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceFingerprint }),
      });
      const tokenResult = (await tokenResponse.json().catch(() => ({}))) as { token?: string; message?: string };
      if (!tokenResponse.ok || !tokenResult.token) throw new Error(tokenResult.message ?? "사진 분석 권한을 준비하지 못했습니다.");
      const nextAccess = { token: tokenResult.token, deviceFingerprint };
      setAnalysisAccess(nextAccess);
      const response = await fetch("/api/auth/signup/price-guide-preview", {
        method: "POST",
        body: formData,
        headers: {
          Authorization: `Bearer ${tokenResult.token}`,
          "X-PM-Device-Fingerprint": deviceFingerprint,
          ...(fixtureId ? { "X-PetManager-Fixture": fixtureId } : {}),
        },
      });
      const result = (await response.json().catch(() => ({}))) as {
        document?: PriceGuideV2;
        services?: SignupServicePrice[];
        message?: string;
        code?: string;
      };
      const nextDocument = result.document ?? (result.services?.length ? buildPriceGuideV2FromLegacySignupServices(result.services, "legacy") : null);
      if (!response.ok || !nextDocument || nextDocument.rows.length === 0) {
        if (result.code !== "PURGE_FAILED") setAnalysisAccess(null);
        const unavailable = response.status === 503 || result.code === "VISION_UNAVAILABLE";
        setState(unavailable ? "unavailable" : "failed");
        setMessage(`${result.message ?? "사진을 판독하지 못했습니다."} 촬영한 사진은 이 화면에 남아 있으니 보면서 직접 입력할 수 있어요.`);
        commitDocument(createManualPriceGuideDocument());
        return;
      }
      commitDocument(nextDocument);
      setState("ready");
      setMessage(signupPriceGuideReviewCopy.supporting);
    } catch {
      setState("failed");
      setMessage("사진 판독 서버에 연결하지 못했습니다. 촬영한 사진을 보면서 직접 입력할 수 있어요.");
      commitDocument(createManualPriceGuideDocument());
    } finally {
      if (cameraInputRef.current) cameraInputRef.current.value = "";
      if (galleryInputRef.current) galleryInputRef.current.value = "";
    }
  };

  const completePricing = async () => {
    if (!priceGuideDocument) return;
    const issues = validatePriceGuideDocument(priceGuideDocument);
    setValidationIssues(issues);
    if (issues.length > 0) {
      focusValidationIssue(issues[0]);
      return;
    }
    if (!(await purgeAnalysis("confirmed"))) return;
    onNext();
  };

  const goBack = async () => {
    if (!(await purgeAnalysis("cancelled"))) return;
    onBack();
  };

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f1f4f8] px-3 py-4 text-[#172033] sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1180px]">
        <section className="overflow-hidden rounded-[18px] border border-[#dce4ed] bg-white">
          <div className="grid lg:grid-cols-[300px_minmax(0,1fr)]">
            <aside className="min-w-0 bg-[#eef3f8] p-4 sm:p-5">
              <p className="text-[12px] font-medium text-[#526174]">요금표 원본</p>
              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={(event) => void analyze(event.target.files?.[0] ?? null)} />
              <input ref={galleryInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void analyze(event.target.files?.[0] ?? null)} />
              {previewUrl ? <div className="relative mt-3 h-40 overflow-hidden rounded-[14px] border border-[#cbd6e3] bg-white"><Image src={previewUrl} alt="선택한 요금표 사진" fill unoptimized className="object-contain" /></div> : <div className="mt-3 flex h-36 flex-col items-center justify-center rounded-[14px] border border-dashed border-[#9fb1c6] bg-white px-3 text-center text-[#1d3557]"><ImagePlus className="h-7 w-7" aria-hidden="true" /><span className="mt-2 text-[14px] font-medium">요금표 사진을 준비해 주세요</span><span className="mt-1 text-[12px] font-normal text-[#64748b]">JPG · PNG · WEBP, 최대 8MB</span></div>}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => cameraInputRef.current?.click()} disabled={state === "loading"} className="flex h-11 items-center justify-center gap-2 rounded-[10px] bg-[#17243c] text-[13px] font-medium text-white disabled:opacity-60"><Camera className="h-4 w-4" aria-hidden="true" />촬영</button>
                <button type="button" onClick={() => galleryInputRef.current?.click()} disabled={state === "loading"} className="flex h-11 items-center justify-center gap-2 rounded-[10px] border border-[#cbd6e3] bg-white text-[13px] font-medium text-[#42536a] disabled:opacity-60">{state === "loading" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ImagePlus className="h-4 w-4" aria-hidden="true" />}선택</button>
              </div>
              {fileName ? <p className="mt-2 truncate text-center text-[12px] font-normal text-[#64748b]">{fileName}</p> : null}
              <div className="mt-4 rounded-[10px] bg-white/80 p-3 text-[12px] font-normal leading-5 text-[#607080]"><ShieldCheck className="mr-1 inline h-4 w-4 text-[#1f7a55]" aria-hidden="true" />사진은 판독 요청 중에만 사용하고 영구 보관하지 않습니다.</div>
              {message ? <p aria-live="polite" className={`mt-3 rounded-[10px] px-3 py-3 text-[12px] font-medium leading-5 ${state === "unavailable" || state === "failed" ? "bg-[#fff2ef] text-[#a84435]" : "bg-white text-[#526174]"}`}>{message}</p> : null}
            </aside>

            <div className="min-w-0 p-4 sm:p-5 lg:p-6" aria-label={signupPriceGuideReviewCopy.label}>
              {priceGuideDocument ? <SignupPriceGuideEditor document={priceGuideDocument} onChange={commitDocument} validationIssues={validationIssues} /> : <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[14px] border border-[#e1e7ef] bg-[#fafbfd] px-4 text-center"><FileImage className="h-8 w-8 text-[#9aa8b8]" aria-hidden="true" /><p className="mt-3 text-[14px] font-medium text-[#526174]">사진을 올리거나 직접 입력해 주세요</p><p className="mt-1 text-[12px] font-normal text-[#7a8798]">사진 분석이 안 되어도 같은 화면에서 계속 입력할 수 있어요.</p></div>}
              <div className="mt-6 grid gap-2 sm:grid-cols-[auto_auto_minmax(220px,1fr)]">
                <button type="button" onClick={() => void goBack()} disabled={purging || state === "loading"} className="flex h-12 items-center justify-center gap-1 rounded-[10px] border border-[#ccd6e2] px-4 text-[13px] font-medium text-[#526174] disabled:opacity-60"><ArrowLeft className="h-4 w-4" aria-hidden="true" />이전</button>
                <button type="button" onClick={() => void startManual()} disabled={purging || state === "loading"} className="flex h-12 items-center justify-center gap-2 rounded-[10px] border border-[#ccd6e2] px-4 text-[13px] font-medium text-[#526174] disabled:opacity-60"><PencilLine className="h-4 w-4" aria-hidden="true" />직접 입력으로 다시 시작</button>
                <button type="button" onClick={() => void completePricing()} disabled={!priceGuideDocument || purging || state === "loading"} className="flex h-12 items-center justify-center gap-2 rounded-[10px] bg-[#17243c] px-4 text-[14px] font-medium text-white disabled:bg-[#c2cbd6]">검토 완료하고 저장<ArrowRight className="h-4 w-4" aria-hidden="true" /></button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
