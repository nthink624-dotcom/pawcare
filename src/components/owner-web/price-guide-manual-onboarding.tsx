"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { validatePriceGuideDocument } from "@/components/auth/signup-price-guide-editor";
import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import PriceGuideStructuredReviewTable from "@/components/owner-web/price-guide-structured-review-table";
import {
  createDirectPriceGuideSkeleton,
  readDirectPriceGuideMatrix,
  writeDirectPriceGuideMatrix,
} from "@/lib/price-guide-direct-matrix";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export function createEmptyManualPriceGuideDocument(): PriceGuideV2 {
  return createDirectPriceGuideSkeleton();
}

export default function PriceGuideManualOnboarding({
  initialDocument,
  onBack,
  onSave,
  onSaveActionReady,
  manualMatrixMode = true,
  temporarySaveNotice,
  onDraftChange,
}: {
  initialDocument?: PriceGuideV2 | null;
  onBack: () => void;
  onSave: (document: PriceGuideV2) => Promise<boolean>;
  onSaveActionReady?: (action: (() => Promise<void | boolean>) | null) => void;
  /** Direct entry opens the table canvas immediately; photo import starts with its clean table review. */
  manualMatrixMode?: boolean;
  temporarySaveNotice?: string;
  onDraftChange?: (document: PriceGuideV2) => void;
}) {
  const [draft, setDraft] = useState<PriceGuideV2>(() => initialDocument ?? createEmptyManualPriceGuideDocument());
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoEditing, setPhotoEditing] = useState(false);
  const [focusFirstMissingDuration, setFocusFirstMissingDuration] = useState(false);
  const [quickServiceName, setQuickServiceName] = useState(() => initialDocument?.rows[0]?.serviceName ?? "목욕");
  const [quickPrice, setQuickPrice] = useState(() => initialDocument?.rows[0]?.priceMinKrw?.toString() ?? "");
  const [quickDuration, setQuickDuration] = useState(() => initialDocument?.rows[0]?.durationMinutes?.toString() ?? "");
  const [quickError, setQuickError] = useState("");
  const initialDocumentSignatureRef = useRef(JSON.stringify(initialDocument ?? null));
  const draftIssues = useMemo(
    () => validatePriceGuideDocument(draft, { photoTable: !manualMatrixMode }),
    [draft, manualMatrixMode],
  );

  useEffect(() => {
    const nextSignature = JSON.stringify(initialDocument ?? null);
    if (nextSignature === initialDocumentSignatureRef.current) return;
    initialDocumentSignatureRef.current = nextSignature;
    const nextDraft = initialDocument ?? createEmptyManualPriceGuideDocument();
    setDraft(nextDraft);
    setQuickServiceName(nextDraft.rows[0]?.serviceName ?? "목욕");
    setQuickPrice(nextDraft.rows[0]?.priceMinKrw?.toString() ?? "");
    setQuickDuration(nextDraft.rows[0]?.durationMinutes?.toString() ?? "");
    setQuickError("");
    setValidationAttempted(false);
    setSaveError("");
    setPhotoEditing(false);
    setFocusFirstMissingDuration(false);
  }, [initialDocument, manualMatrixMode]);

  function updateDraft(next: PriceGuideV2) {
    const contentChanged = JSON.stringify({ rows: draft.rows, tableGroups: draft.tableGroups, surcharges: draft.surcharges, overallNote: draft.overallNote })
      !== JSON.stringify({ rows: next.rows, tableGroups: next.tableGroups, surcharges: next.surcharges, overallNote: next.overallNote });
    const aiDerived = ["ai_imported", "owner_corrected", "owner_confirmed", "vision", "fixture"].includes(draft.source);
    const updated: PriceGuideV2 = contentChanged && aiDerived ? { ...next, source: "owner_corrected" } : next;
    setDraft(updated);
    onDraftChange?.(updated);
    setSaveError("");
    setFocusFirstMissingDuration(false);
  }

  function applyQuickEntry() {
    const serviceName = quickServiceName.trim();
    const priceDigits = quickPrice.replace(/\D/g, "");
    const durationDigits = quickDuration.replace(/\D/g, "");
    const price = priceDigits ? Number(priceDigits) : null;
    const duration = durationDigits ? Number(durationDigits) : null;
    if (!serviceName) {
      setQuickError("서비스명을 입력해 주세요.");
      return;
    }
    if (!price || price < 1) {
      setQuickError("가격을 입력해 주세요.");
      return;
    }
    if (!duration || duration < 1) {
      setQuickError("예상 시간을 입력해 주세요.");
      return;
    }

    const groups = readDirectPriceGuideMatrix(draft);
    const nextGroups = groups.map((group) => ({
      ...group,
      serviceNames: group.serviceNames.length > 0
        ? [serviceName, ...group.serviceNames.slice(1)]
        : [serviceName],
      cells: group.cells.map((row) => row.map((cell, serviceIndex) => serviceIndex === 0
        ? {
          ...cell,
          serviceName,
          priceKind: "fixed" as const,
          priceMinKrw: price,
          priceMaxKrw: null,
          durationMinutes: duration,
        }
        : cell)),
    }));
    updateDraft(writeDirectPriceGuideMatrix({ ...draft, source: "manual" }, nextGroups));
    setQuickError("");
  }

  const saveDraft = useCallback(async () => {
    setValidationAttempted(true);
    setSaveError("");
    if (draftIssues.length > 0) {
      if (!manualMatrixMode) setPhotoEditing(true);
      globalThis.requestAnimationFrame(() => globalThis.document.getElementById(draftIssues[0].inputId)?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(draft);
      if (!saved) {
        setSaveError("요금표를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
        return;
      }
      setValidationAttempted(false);
      if (!manualMatrixMode) setPhotoEditing(false);
      return true;
    } catch {
      setSaveError("요금표를 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다.");
    } finally {
      setSaving(false);
    }
  }, [draft, draftIssues, manualMatrixMode, onSave]);

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
    <section className="min-w-0 space-y-3" data-testid="price-guide-manual-onboarding">
      {!manualMatrixMode ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-2 text-[14px] font-medium leading-5 text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          등록 방식으로 돌아가기
        </button>
      ) : null}
      {manualMatrixMode ? (
        <section className="rounded-[12px] border border-[#d9e2ee] bg-[#f8fafc] p-4" data-testid="price-guide-inline-quick-entry">
          <div className="mb-3">
            <h2 className="text-[16px] font-semibold leading-6 text-[#172033]">간편 입력</h2>
            <p className="mt-1 text-[13px] leading-5 text-[#607080]">서비스 하나의 가격과 예상 시간을 입력하면 모든 체중 구간에 한 번에 반영돼요.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
            <label className="min-w-0 text-[13px] font-medium leading-5 text-[#42536a]">
              서비스명
              <input
                value={quickServiceName}
                onChange={(event) => { setQuickServiceName(event.target.value); setQuickError(""); }}
                className="mt-1 h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-normal leading-6 text-[#172033] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
                placeholder="예: 목욕"
              />
            </label>
            <label className="min-w-0 text-[13px] font-medium leading-5 text-[#42536a]">
              가격(원)
              <input
                value={quickPrice}
                onChange={(event) => { setQuickPrice(event.target.value.replace(/\D/g, "")); setQuickError(""); }}
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-normal leading-6 text-[#172033] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
                placeholder="예: 30000"
              />
            </label>
            <label className="min-w-0 text-[13px] font-medium leading-5 text-[#42536a]">
              예상 시간(분)
              <input
                value={quickDuration}
                onChange={(event) => { setQuickDuration(event.target.value.replace(/\D/g, "")); setQuickError(""); }}
                inputMode="numeric"
                className="mt-1 h-11 w-full rounded-[8px] border border-[#cbd5e1] bg-white px-3 text-[16px] font-normal leading-6 text-[#172033] outline-none focus-visible:border-[#2563eb] focus-visible:ring-2 focus-visible:ring-[#2563eb]/20"
                placeholder="예: 60"
              />
            </label>
            <button
              type="button"
              onClick={applyQuickEntry}
              className="inline-flex min-h-11 items-center justify-center rounded-[8px] bg-[#2563eb] px-4 text-[14px] font-medium leading-5 text-white hover:bg-[#1d4ed8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
            >
              요금표에 반영
            </button>
          </div>
          {quickError ? <p role="alert" className="mt-2 text-[13px] font-medium leading-5 text-[#a04455]">{quickError}</p> : null}
        </section>
      ) : null}
      {manualMatrixMode || photoEditing ? (
        <PriceGuideNativeInlineTable
          document={draft}
          onChange={updateDraft}
          validationIssues={validationAttempted ? draftIssues : []}
          heading={manualMatrixMode ? "요금표 직접 등록" : "요금표 수정"}
          photoReviewMode={!manualMatrixMode}
          focusFirstMissingDuration={focusFirstMissingDuration}
          priceFirstDurationControls={manualMatrixMode}
          hideHeader={manualMatrixMode}
        />
      ) : (
        <PriceGuideStructuredReviewTable
          document={draft}
          onEdit={() => {
            setFocusFirstMissingDuration(false);
            setPhotoEditing(true);
          }}
          onSetAverageTime={() => {
            setFocusFirstMissingDuration(true);
            setPhotoEditing(true);
          }}
        />
      )}
      {saveError ? <p role="alert" className="text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
      {temporarySaveNotice && <p role="status" aria-live="polite" data-price-guide-autosave-status className="text-[16px] leading-6 text-[#526174]">{temporarySaveNotice}</p>}
      <div className="flex flex-wrap gap-3">
      <button
        type="button"
        onClick={() => void saveDraft()}
        disabled={saving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#172033] px-5 text-[14px] font-medium leading-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {saving ? "저장 중" : "상세 요금표 저장"}
      </button>
      </div>
    </section>
  );
}
