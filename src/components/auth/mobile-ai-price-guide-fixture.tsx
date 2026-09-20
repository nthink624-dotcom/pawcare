"use client";

import { ArrowLeft, Camera, ImagePlus, LoaderCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import SetupModal from "@/components/ui/setup-modal";
import MobilePriceGuideMatrix from "@/components/auth/mobile-price-guide-matrix";
import { canUseExternalCameraApps, captureWithAndroidCameraApp } from "@/lib/media/external-camera";
import { createMobilePriceGuideSkeleton } from "@/lib/price-photo/mobile-price-guide-matrix";
import { createMobilePricePhotoCoordinator, type MobilePriceGuideV2, type MobilePriceKind } from "@/lib/price-photo/mobile-price-photo-adapter";
import {
  createManualPriceDocument,
  createMobilePricePhotoHttpAdapter,
  getMobilePricePhotoRecoveryMessage,
  MobilePricePhotoAuthenticationError,
  toMobilePriceDrafts,
} from "@/lib/price-photo/mobile-price-photo-http-adapter";

export type PriceGuideDraftRow = {
  id: string;
  name: string;
  price: string;
  priceKind?: MobilePriceKind;
  maximumPrice?: string;
  durationMinutes?: string;
  rowIndex?: number;
  needsReview?: boolean;
  dirty?: boolean;
};

export type PriceGuideSessionState = {
  rows: PriceGuideDraftRow[];
  document: MobilePriceGuideV2;
  serviceId: string | null;
  resumeMode: "manual" | "review";
};

type Mode = "method" | "choose" | "consent" | "analyzing" | "review" | "manual" | "recovery";

const OWNER_BOTTOM_NAV_CLEARANCE_PX = 64;
const PRICE_GUIDE_FOOTER_HEIGHT_PX = 72;
const PRICE_GUIDE_CONTENT_GAP_PX = 16;

const fixtureRows: PriceGuideDraftRow[] = [
  { id: "fixture-bath", name: "목욕", price: "25000", durationMinutes: "45" },
  { id: "fixture-cut", name: "전체 미용", price: "55000", durationMinutes: "90" },
  { id: "fixture-face", name: "부분 미용", price: "20000", durationMinutes: "30", needsReview: true },
];

function draftRows(document: MobilePriceGuideV2): PriceGuideDraftRow[] {
  return toMobilePriceDrafts(document).map((row) => ({
    id: row.clientId,
    rowIndex: row.rowIndex,
    name: row.serviceName,
    priceKind: row.priceKind,
    price: String(row.fixedPrice ?? row.minimumPrice ?? ""),
    maximumPrice: String(row.maximumPrice ?? ""),
    durationMinutes: row.durationMinutes === null ? "" : String(row.durationMinutes),
  }));
}

function documentFromInitialRows(rows: PriceGuideDraftRow[]) {
  return createManualPriceDocument(rows.map((row, rowIndex) => ({
    clientId: row.id,
    rowIndex,
    serviceName: row.name,
    priceKind: row.priceKind ?? "fixed",
    fixedPrice: (row.priceKind ?? "fixed") === "fixed" && row.price ? Number(row.price) : null,
    minimumPrice: row.price ? Number(row.price) : null,
    maximumPrice: row.maximumPrice ? Number(row.maximumPrice) : null,
    durationMinutes: row.durationMinutes ? Number(row.durationMinutes) : null,
  })));
}

function fixtureDocument() {
  return { ...documentFromInitialRows(fixtureRows), source: "fixture" as const };
}

export default function MobileAiPriceGuideFixture({
  initialRows,
  initialDocument = null,
  initialServiceId = null,
  initialResumeMode,
  onComplete,
  onExit,
  shopId,
  ownerBottomNavigation = Boolean(shopId),
  presentation = "page",
  setupFlow = false,
}: {
  initialRows: PriceGuideDraftRow[] | null;
  initialDocument?: MobilePriceGuideV2 | null;
  initialServiceId?: string | null;
  initialResumeMode?: "manual" | "review";
  onComplete: (rows: PriceGuideDraftRow[], state?: PriceGuideSessionState) => void;
  onExit: (rows: PriceGuideDraftRow[] | null, state?: PriceGuideSessionState | null) => void;
  shopId?: string;
  ownerBottomNavigation?: boolean;
  presentation?: "page" | "modal";
  setupFlow?: boolean;
}) {
  const initialDocumentValue = initialDocument ?? (initialRows?.length ? documentFromInitialRows(initialRows) : null);
  const [mode, setMode] = useState<Mode>(initialDocumentValue ? (initialResumeMode ?? (initialDocumentValue.source === "manual" ? "manual" : "review")) : shopId ? "method" : "choose");
  const [document, setDocument] = useState<MobilePriceGuideV2 | null>(initialDocumentValue);
  const [persistedServiceId, setPersistedServiceId] = useState<string | null>(initialServiceId);
  const [isDirty, setIsDirty] = useState(false);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [analysisError, setAnalysisError] = useState(false);
  const [authRecoveryRequired, setAuthRecoveryRequired] = useState(false);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [openingCamera, setOpeningCamera] = useState(false);
  const [privacyPrompt, setPrivacyPrompt] = useState(false);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [pendingAnalysisFile, setPendingAnalysisFile] = useState<File | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [discardConfirmOpen, setDiscardConfirmOpen] = useState(false);
  const originalUrlRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const privacyInputRef = useRef<HTMLInputElement>(null);
  const invalidRef = useRef<HTMLDivElement>(null);
  const coordinatorRef = useRef<ReturnType<typeof createMobilePricePhotoCoordinator> | null>(null);
  const initialDocumentRef = useRef(initialDocumentValue);
  const initialServiceIdRef = useRef(initialServiceId);
  const realMode = Boolean(shopId);
  const selectionMode: Extract<Mode, "method" | "choose"> = shopId ? "method" : "choose";

  useEffect(() => {
    if (!shopId) return;
    const backendOrigin = process.env.NEXT_PUBLIC_API_BASE_URL;
    if (!backendOrigin) {
      coordinatorRef.current = null;
      return;
    }
    coordinatorRef.current = createMobilePricePhotoCoordinator(createMobilePricePhotoHttpAdapter({ backendOrigin, shopId }));
    return () => coordinatorRef.current?.cancel();
  }, [shopId]);

  const sessionFor = useCallback((value: MobilePriceGuideV2 | null): PriceGuideSessionState | null => (
    value ? { rows: draftRows(value), document: value, serviceId: persistedServiceId, resumeMode: mode === "manual" ? "manual" : "review" } : null
  ), [mode, persistedServiceId]);

  const purgePhoto = () => {
    if (originalUrlRef.current) URL.revokeObjectURL(originalUrlRef.current);
    originalUrlRef.current = null;
  };

  useEffect(() => purgePhoto, []);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const updateInset = () => setKeyboardInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
    };
  }, []);

  const requestExit = useCallback(() => {
    if (saving || openingCamera || mode === "analyzing") return;
    if (setupFlow) {
      coordinatorRef.current?.cancel();
      purgePhoto();
      setPendingAnalysisFile(null);
      onExit(document ? draftRows(document) : null, sessionFor(document));
      return;
    }
    if (isDirty) {
      setDiscardOpen(true);
      return;
    }
    purgePhoto();
    setPendingAnalysisFile(null);
    onExit(document ? draftRows(document) : null, sessionFor(document));
  }, [document, isDirty, onExit, sessionFor, saving, openingCamera, mode, setupFlow]);

  useEffect(() => {
    const onOwnerMobileBackRequest = (event: Event) => {
      event.preventDefault();
      requestExit();
    };
    window.addEventListener("owner-mobile-back-request", onOwnerMobileBackRequest);
    return () => window.removeEventListener("owner-mobile-back-request", onOwnerMobileBackRequest);
  }, [requestExit]);

  const beginAnalysis = async (file?: File) => {
    if (file && !["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAnalysisError(true);
      setMode("recovery");
      return;
    }
    purgePhoto();
    if (file) originalUrlRef.current = URL.createObjectURL(file);
    setAnalysisError(false);
    setAuthRecoveryRequired(false);
    setActionError("");
    setMode("analyzing");
    if (realMode) {
      const coordinator = coordinatorRef.current;
      if (!file || !coordinator) {
        setActionError("요금표 연결 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        setMode("recovery");
        return;
      }
      try {
        const analysis = await coordinator.analyze(file);
        setDocument(analysis.document);
        setIsDirty(true);
        purgePhoto();
        setMode("review");
      } catch (error) {
        purgePhoto();
        setPendingAnalysisFile(null);
        if (error instanceof DOMException && error.name === "AbortError") {
          setMode(selectionMode);
          return;
        }
        const isAuthenticationFailure = error instanceof MobilePricePhotoAuthenticationError;
        setAuthRecoveryRequired(isAuthenticationFailure);
        setActionError(isAuthenticationFailure ? "로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요." : getMobilePricePhotoRecoveryMessage(error));
        setMode("recovery");
      }
      return;
    }
    window.setTimeout(() => {
      setDocument(fixtureDocument());
      setIsDirty(true);
      purgePhoto();
      setMode("review");
    }, 650);
  };

  const requestAnalysisConsent = (file: File) => {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setAnalysisError(true);
      setMode("recovery");
      return;
    }
    setPendingAnalysisFile(file);
    setMode("consent");
  };

  const confirmAnalysisConsent = () => {
    const file = pendingAnalysisFile;
    if (!file) {
      setActionError("분석할 사진을 확인하지 못했습니다. 다시 선택해 주세요.");
      setMode("recovery");
      return;
    }
    setPendingAnalysisFile(null);
    void beginAnalysis(file);
  };

  const startManual = () => {
    setPendingAnalysisFile(null);
    setDocument((current) => current ?? createMobilePriceGuideSkeleton());
    setIsDirty(true);
    setMode("manual");
  };

  const save = async () => {
    if (!document?.rows.length) {
      invalidRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setActionError("저장할 요금표 항목을 입력해 주세요.");
      return;
    }
    if (realMode) {
      const coordinator = coordinatorRef.current;
      if (!coordinator) {
        setActionError("요금표 연결 정보를 확인하지 못했습니다. 잠시 후 다시 시도해 주세요.");
        return;
      }
      setSaving(true);
      setActionError("");
      try {
        const persisted = await coordinator.saveAndRequery(document, persistedServiceId);
        const persistedRows = draftRows(persisted.document);
        const persistedState: PriceGuideSessionState = { rows: persistedRows, document: persisted.document, serviceId: persisted.serviceId, resumeMode: mode === "manual" ? "manual" : "review" };
        setDocument(persisted.document);
        setPersistedServiceId(persisted.serviceId);
        setIsDirty(false);
        purgePhoto();
        onComplete(persistedRows, persistedState);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : "저장하지 못했습니다. 입력 내용은 그대로 두었어요.");
      } finally {
        setSaving(false);
      }
      return;
    }
    setIsDirty(false);
    purgePhoto();
    const rows = draftRows(document);
    onComplete(rows, { rows, document, serviceId: null, resumeMode: mode === "manual" ? "manual" : "review" });
  };

  const saveDraftAndExit = () => {
    if (!document) return;
    coordinatorRef.current?.cancel();
    purgePhoto();
    setPendingAnalysisFile(null);
    setIsDirty(false);
    setDiscardOpen(false);
    onExit(draftRows(document), sessionFor(document));
  };

  const requestDiscard = () => {
    setDiscardOpen(false);
    setDiscardConfirmOpen(true);
  };

  const confirmDiscard = () => {
    coordinatorRef.current?.cancel();
    purgePhoto();
    setPendingAnalysisFile(null);
    setDocument(initialDocumentRef.current);
    setPersistedServiceId(initialServiceIdRef.current);
    setIsDirty(false);
    setDiscardConfirmOpen(false);
    const initial = initialDocumentRef.current;
    onExit(initial ? draftRows(initial) : null, initial ? {
      rows: draftRows(initial), document: initial, serviceId: initialServiceIdRef.current, resumeMode: initial.source === "manual" ? "manual" : "review",
    } : null);
  };

  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) requestAnalysisConsent(file);
  };

  const openCamera = async () => {
    if (mode === "choose" && !privacyConfirmed) {
      setPrivacyPrompt(true);
      privacyInputRef.current?.focus();
      privacyInputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (!canUseExternalCameraApps()) {
      cameraInputRef.current?.click();
      return;
    }
    setOpeningCamera(true);
    setActionError("");
    try {
      requestAnalysisConsent(await captureWithAndroidCameraApp("default"));
    } catch (error) {
      if (!(error instanceof Error && error.message === "CAMERA_CANCELLED")) {
        setActionError("카메라 앱을 열지 못했습니다. 다시 시도하거나 앨범에서 선택해 주세요.");
      }
    } finally {
      setOpeningCamera(false);
    }
  };

  const inModal = presentation === "modal";
  const reviewModeActive = (mode === "review" || mode === "manual") && Boolean(document);
  const ownerBottomNavClearance = ownerBottomNavigation ? OWNER_BOTTOM_NAV_CLEARANCE_PX : 0;
  const footerBottomInset = keyboardInset > 0 ? keyboardInset : ownerBottomNavClearance;
  const reviewContentStyle = reviewModeActive && !inModal ? {
    paddingBottom: `calc(env(safe-area-inset-bottom) + ${footerBottomInset + PRICE_GUIDE_FOOTER_HEIGHT_PX + PRICE_GUIDE_CONTENT_GAP_PX}px)`,
  } : undefined;
  const footerStyle = {
    bottom: `calc(env(safe-area-inset-bottom) + ${footerBottomInset}px)`,
  };

  return (
    <section className={`mx-auto w-full min-w-0 max-w-[430px] ${inModal ? "flex max-h-[calc(100dvh-48px)] flex-col bg-white" : mode === selectionMode ? "min-h-dvh bg-white" : ""}`} aria-label="요금표 사진 검토" style={reviewContentStyle} data-price-guide-review-content={reviewModeActive ? "active" : undefined}>
      <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp" capture="environment" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={selectPhoto} />
      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" tabIndex={-1} aria-hidden="true" className="sr-only" onChange={selectPhoto} />

      {mode === "method" && <div className="space-y-4 p-5">
        <h2 className="text-[20px] font-semibold leading-7 text-[#111a30]">서비스 요금 설정</h2>
        <button type="button" disabled={openingCamera} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-[10px] border border-slate-200 px-4 text-[16px] font-medium disabled:cursor-wait disabled:opacity-70" onClick={() => void openCamera()}><Camera size={22} aria-hidden />{openingCamera ? "카메라 여는 중..." : "사진으로 요금표 등록"}</button>
        <button type="button" className="flex min-h-14 w-full items-center justify-center gap-3 rounded-[10px] border border-slate-200 px-4 text-[16px] font-medium" onClick={() => fileInputRef.current?.click()}><ImagePlus size={22} aria-hidden />앨범에서 선택</button>
        <button type="button" className="min-h-14 w-full rounded-[10px] border border-slate-200 px-4 text-[16px] font-medium" onClick={startManual}>직접 입력</button>
      </div>}

      {mode === "choose" && (
        <div className={inModal ? "min-h-0 overflow-y-auto" : "min-h-full"}>
          <header className={inModal ? "sticky top-0 z-30 bg-white" : "fixed inset-x-0 top-0 z-30 mx-auto max-w-[430px] bg-white pt-[env(safe-area-inset-top)]"} data-price-photo-app-bar>
            <div className="flex min-h-14 items-center px-3">
              <h2 className="px-2 text-[20px] font-semibold leading-7 text-[#111a30]">사진으로 요금표 등록</h2>
            </div>
          </header>
          <div className={inModal ? "px-5 pt-2" : "px-5 pt-[calc(env(safe-area-inset-top)+72px)]"}>
            <section className="space-y-3 bg-white pb-6" data-price-photo-registration-content>
              <label className={`flex min-h-11 items-center gap-3 rounded-[10px] bg-white py-2 text-left ${privacyPrompt ? "ring-2 ring-blue-100" : ""}`}><input ref={privacyInputRef} type="checkbox" checked={privacyConfirmed} aria-describedby={privacyPrompt ? "price-photo-privacy-prompt" : undefined} onChange={(event) => { setPrivacyConfirmed(event.target.checked); if (event.target.checked) setPrivacyPrompt(false); }} className="size-[18px] shrink-0 accent-[#111a30]" /><span className="text-[16px] font-normal leading-6 text-slate-700">사진에 개인정보가 없어요</span></label>
              {privacyPrompt && <p id="price-photo-privacy-prompt" role="alert" className="text-[14px] leading-5 text-blue-700">먼저 사진에 개인정보가 없는지 확인해 주세요.</p>}
              <button type="button" disabled={openingCamera} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-[10px] bg-[#111a30] px-4 py-3 text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70" onClick={() => void openCamera()}><span className="shrink-0 text-white"><Camera size={22} /></span><span className="min-w-0 text-[16px] font-medium text-white">{openingCamera ? "카메라 여는 중..." : "카메라로 촬영"}</span></button>
              <button type="button" disabled={!privacyConfirmed} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-[10px] border border-slate-200 bg-white px-4 py-3 text-center outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:opacity-70" onClick={() => fileInputRef.current?.click()}><span className="shrink-0 text-slate-700"><ImagePlus size={22} /></span><span className="min-w-0 text-[16px] font-medium text-slate-900">앨범에서 선택</span></button>
              {actionError && <p role="alert" className="text-center text-[14px] font-medium text-rose-700">{actionError}</p>}
            </section>
          </div>
        </div>
      )}

      {mode === "consent" && (
        <div className={`space-y-4 px-5 pt-2 ${inModal ? "min-h-0 overflow-y-auto pb-5" : ""}`}><button type="button" className="inline-flex min-h-11 items-center gap-2 rounded-[10px] px-2 text-[14px] font-medium text-slate-700 outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={() => { setPendingAnalysisFile(null); setMode(selectionMode); }}><ArrowLeft className="size-5" aria-hidden="true" />요금표 등록 방식으로 돌아가기</button><section className="rounded-[14px] border border-slate-200 bg-white p-4" aria-labelledby="price-photo-analysis-consent-title"><h2 id="price-photo-analysis-consent-title" className="text-[20px] font-semibold leading-7 text-slate-900">사진 분석 전 확인</h2><p className="mt-2 text-[14px] font-normal leading-5 text-slate-700">비식별 파생 이미지를 OpenAI로 전송해 서비스명·가격 초안을 생성합니다.</p><p className="mt-2 text-[14px] font-normal leading-5 text-slate-700">원본 사진에 고객 이름, 전화번호 등 개인정보가 보이지 않는지 다시 확인해 주세요.</p></section><button type="button" className="min-h-12 w-full rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" onClick={confirmAnalysisConsent}>동의하고 분석</button><button type="button" className="min-h-12 w-full rounded-[10px] border border-slate-200 bg-white px-4 text-[16px] font-medium leading-6 text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={startManual}>직접 입력</button></div>
      )}

      {mode === "analyzing" && <div className="grid min-h-72 place-items-center px-5 text-center"><div><LoaderCircle className="mx-auto animate-spin text-blue-600" size={34} /><h2 className="auth-type-section-title mt-4 text-slate-900">사진을 읽고 있어요</h2><p className="auth-type-helper mt-2 text-slate-600">잠시만 기다려 주세요.</p><button type="button" className="mt-5 min-h-11 px-4 text-[14px] font-medium text-slate-700 underline underline-offset-4" onClick={() => { coordinatorRef.current?.cancel(); purgePhoto(); setMode(selectionMode); }}>취소</button></div></div>}

      {mode === "recovery" && (
        <div className={`space-y-4 px-5 pt-2 ${inModal ? "min-h-0 overflow-y-auto pb-5" : ""}`}>{authRecoveryRequired ? <><div className="rounded-[14px] border border-amber-200 bg-amber-50 p-5"><h2 className="auth-type-section-title text-slate-900">로그인 정보를 확인하지 못했습니다.</h2><p className="auth-type-helper mt-2 text-slate-700">다시 로그인한 뒤 사진 요금표를 이용해 주세요.</p></div><button type="button" className="min-h-12 w-full rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium text-white" onClick={() => { purgePhoto(); setPendingAnalysisFile(null); window.location.assign("/login?next=/owner/mobile"); }}>로그인으로 이동</button></> : <><div className="rounded-[14px] border border-amber-200 bg-amber-50 p-5"><h2 className="auth-type-section-title text-slate-900">사진 처리를 완료하지 못했어요</h2><p className="auth-type-helper mt-2 text-slate-700">사진을 다시 선택하거나 직접 입력으로 계속할 수 있어요. 임시 내용은 공개되지 않습니다.</p></div><button type="button" className="min-h-12 w-full rounded-[10px] bg-blue-600 px-4 text-[16px] font-medium text-white" onClick={() => fileInputRef.current?.click()}>사진으로 다시 불러오기</button><button type="button" className="min-h-12 w-full rounded-[10px] border border-slate-200 bg-white px-4 text-[16px] font-medium text-slate-800" onClick={startManual}>직접 입력</button>{analysisError && <p className="text-center text-[14px] text-slate-500">지원하지 않는 파일 형식입니다.</p>}{actionError && <p role="alert" className="text-center text-[14px] font-medium text-rose-700">{actionError}</p>}</>}</div>
      )}

      {(mode === "review" || mode === "manual") && document && (
        <div className={`min-w-0 max-w-full space-y-4 px-4 pt-2 ${inModal ? "min-h-0 flex-1 overflow-y-auto pb-4" : ""}`} ref={invalidRef}><header className="flex items-center justify-between gap-3"><h2 className="auth-type-section-title min-w-0 text-slate-900">{mode === "manual" ? "서비스 직접 입력" : "분석한 요금표 확인"}</h2><button type="button" aria-label="요금표 가져오기 닫기" className="grid size-11 shrink-0 place-items-center rounded-full text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-blue-600" onClick={requestExit}><X size={22} /></button></header>{mode === "manual" && <button type="button" className="min-h-11 rounded-[10px] border border-blue-200 bg-blue-50 px-3 text-[14px] font-medium text-blue-700" onClick={() => fileInputRef.current?.click()}>사진으로 다시 불러오기</button>}<MobilePriceGuideMatrix document={document} onChange={(next) => { setDocument({ ...next, source: next.source === "manual" ? "manual" : "owner_corrected" }); setIsDirty(true); setActionError(""); }} />{actionError && <p role="alert" className="rounded-[10px] bg-rose-50 p-3 text-[14px] font-medium text-rose-700">{actionError}</p>}</div>
      )}

      {(reviewModeActive || (setupFlow && mode === "method")) && <footer className={`${inModal ? "shrink-0" : "fixed inset-x-0 z-30 mx-auto max-w-[430px]"} border-t border-slate-200 bg-white px-5 py-3`} style={inModal ? undefined : footerStyle} data-price-guide-review-footer><div className={setupFlow ? "grid gap-3" : "flex gap-3"} style={setupFlow ? { gridTemplateColumns: "minmax(0,35fr) minmax(0,65fr)" } : undefined}><button type="button" disabled={saving || openingCamera} className="min-h-12 flex-1 rounded-[10px] border border-slate-200 bg-white text-[16px] font-medium text-slate-700 disabled:opacity-50" onClick={setupFlow ? requestExit : saveDraftAndExit}>{setupFlow ? "이전" : "임시 저장"}</button><button type="button" disabled={saving || !document} className="min-h-12 flex-[1.4] rounded-[10px] bg-[#111a30] px-3 text-[16px] font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-300" onClick={() => void save()}>{saving ? "저장 중..." : "저장하기"}</button></div></footer>}

      {discardOpen && <SetupModal label="작성 중인 내용" onCancel={() => setDiscardOpen(false)}><div className="w-full bg-white p-5"><h2 className="auth-type-section-title text-slate-900">작성 중인 내용이 있어요</h2><div className="mt-5 grid gap-2"><button type="button" className="min-h-11 rounded-[10px] border border-slate-200 text-[16px] font-medium text-slate-700" onClick={() => setDiscardOpen(false)}>계속 작성</button><button type="button" className="min-h-11 rounded-[10px] bg-[#111a30] text-[16px] font-medium text-white" onClick={saveDraftAndExit}>임시 저장 후 나가기</button><button type="button" className="min-h-11 rounded-[10px] text-[16px] font-medium text-[#9a5e4e]" onClick={requestDiscard}>작성 내용 삭제</button></div></div></SetupModal>}
      {discardConfirmOpen && <SetupModal label="작성 내용 삭제 확인" onCancel={() => setDiscardConfirmOpen(false)}><div className="w-full bg-white p-5"><h2 className="auth-type-section-title text-slate-900">작성 내용을 삭제할까요?</h2><div className="mt-5 grid gap-2"><button type="button" className="min-h-11 rounded-[10px] border border-slate-200 text-[16px] font-medium text-slate-700" onClick={() => setDiscardConfirmOpen(false)}>계속 작성</button><button type="button" className="min-h-11 rounded-[10px] text-[16px] font-medium text-[#9a5e4e]" onClick={confirmDiscard}>작성 내용 삭제</button></div></div></SetupModal>}
    </section>
  );
}
