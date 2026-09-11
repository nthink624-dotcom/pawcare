"use client";

import { ArrowLeft, Check } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { validatePriceGuideDocument } from "@/components/auth/signup-price-guide-editor";
import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import PriceGuideStructuredReviewTable from "@/components/owner-web/price-guide-structured-review-table";
import { createDirectPriceGuideSkeleton } from "@/lib/price-guide-direct-matrix";
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
}: {
  initialDocument?: PriceGuideV2 | null;
  onBack: () => void;
  onSave: (document: PriceGuideV2) => Promise<boolean>;
  onSaveActionReady?: (action: (() => Promise<void>) | null) => void;
  /** Direct entry opens the table canvas immediately; photo import starts with its clean table review. */
  manualMatrixMode?: boolean;
}) {
  const [draft, setDraft] = useState<PriceGuideV2>(() => initialDocument ?? createEmptyManualPriceGuideDocument());
  const [validationAttempted, setValidationAttempted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [photoEditing, setPhotoEditing] = useState(false);
  const [focusFirstMissingDuration, setFocusFirstMissingDuration] = useState(false);
  const initialDocumentSignatureRef = useRef(JSON.stringify(initialDocument ?? null));
  const draftIssues = useMemo(
    () => validatePriceGuideDocument(draft, { photoTable: !manualMatrixMode }),
    [draft, manualMatrixMode],
  );

  useEffect(() => {
    const nextSignature = JSON.stringify(initialDocument ?? null);
    if (nextSignature === initialDocumentSignatureRef.current) return;
    initialDocumentSignatureRef.current = nextSignature;
    setDraft(initialDocument ?? createEmptyManualPriceGuideDocument());
    setValidationAttempted(false);
    setSaveError("");
    setPhotoEditing(false);
    setFocusFirstMissingDuration(false);
  }, [initialDocument, manualMatrixMode]);

  function updateDraft(next: PriceGuideV2) {
    const contentChanged = JSON.stringify({ rows: draft.rows, tableGroups: draft.tableGroups, surcharges: draft.surcharges, overallNote: draft.overallNote })
      !== JSON.stringify({ rows: next.rows, tableGroups: next.tableGroups, surcharges: next.surcharges, overallNote: next.overallNote });
    const aiDerived = ["ai_imported", "owner_corrected", "owner_confirmed", "vision", "fixture"].includes(draft.source);
    setDraft(contentChanged && aiDerived ? { ...next, source: "owner_corrected" } : next);
    setSaveError("");
    setFocusFirstMissingDuration(false);
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
      <button
        type="button"
        onClick={onBack}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-[8px] px-2 text-[14px] font-medium leading-5 text-[#526174] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        등록 방식으로 돌아가기
      </button>
      {manualMatrixMode || photoEditing ? (
        <PriceGuideNativeInlineTable
          document={draft}
          onChange={updateDraft}
          validationIssues={validationAttempted ? draftIssues : []}
          heading={manualMatrixMode ? "요금표 직접 등록" : "요금표 수정"}
          photoReviewMode={!manualMatrixMode}
          focusFirstMissingDuration={focusFirstMissingDuration}
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
      <button
        type="button"
        onClick={() => void saveDraft()}
        disabled={saving}
        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#172033] px-5 text-[14px] font-medium leading-5 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        <Check className="h-4 w-4" aria-hidden="true" />
        {saving ? "저장 중" : "상세 요금표 저장"}
      </button>
    </section>
  );
}
