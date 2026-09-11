"use client";

import { Check, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  validatePriceGuideDocument,
  type PriceGuideValidationIssue,
} from "@/components/auth/signup-price-guide-editor";
import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import PriceGuideStructuredReviewTable from "@/components/owner-web/price-guide-structured-review-table";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export function isFixedManualPriceGuideDocument(document: PriceGuideV2) {
  return document.source === "manual" && document.rows.every((row) => row.priceKind === "fixed");
}

export function isPhotoPriceGuideDocument(document: PriceGuideV2) {
  return ["ai_imported", "owner_corrected", "owner_confirmed", "vision", "fixture"].includes(document.source);
}

type PriceGuideV2ServiceDetailProps = {
  document: PriceGuideV2;
  onSave: (next: PriceGuideV2) => void | boolean | Promise<void | boolean>;
  /** Retained for callers while all PriceGuideV2 documents share the native table canvas. */
  startEditing?: boolean;
  /** Retained for the stored-document compatibility boundary. */
  manualMatrixMode?: boolean;
  onSaveActionReady?: (action: (() => Promise<void>) | null) => void;
};

export default function PriceGuideV2ServiceDetail({
  document: value,
  onSave,
  onSaveActionReady,
}: PriceGuideV2ServiceDetailProps) {
  const valueSignature = JSON.stringify(value);
  const photoTable = isPhotoPriceGuideDocument(value);
  const [draft, setDraft] = useState<PriceGuideV2>(value);
  const [validationIssues, setValidationIssues] = useState<PriceGuideValidationIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [editing, setEditing] = useState(!photoTable);
  const [focusFirstMissingDuration, setFocusFirstMissingDuration] = useState(false);
  const draftIssues = useMemo(() => validatePriceGuideDocument(draft, { photoTable }), [draft, photoTable]);
  const dirty = JSON.stringify(draft) !== valueSignature;
  const syncedValueSignatureRef = useRef(valueSignature);

  useEffect(() => {
    if (syncedValueSignatureRef.current === valueSignature) return;
    syncedValueSignatureRef.current = valueSignature;
    setDraft(value);
    setValidationIssues([]);
    setSaveError("");
    setEditing(!isPhotoPriceGuideDocument(value));
    setFocusFirstMissingDuration(false);
  }, [value, valueSignature]);

  function updateDraft(next: PriceGuideV2) {
    setDraft(value.source === "manual" ? next : { ...next, source: "owner_corrected" });
    setValidationIssues([]);
    setSaveError("");
    setFocusFirstMissingDuration(false);
  }

  function resetDraft() {
    setDraft(value);
    setValidationIssues([]);
    setSaveError("");
    setEditing(!photoTable);
    setFocusFirstMissingDuration(false);
  }

  const saveDraft = useCallback(async () => {
    setValidationIssues(draftIssues);
    setSaveError("");
    if (draftIssues.length > 0) {
      if (photoTable) setEditing(true);
      globalThis.requestAnimationFrame(() => globalThis.document.getElementById(draftIssues[0].inputId)?.focus());
      return;
    }
    setSaving(true);
    try {
      const saved = await onSave(draft);
      if (saved === false) {
        setSaveError("요금표를 저장하지 못했습니다. 입력 내용을 확인하고 다시 시도해 주세요.");
        return;
      }
      setValidationIssues([]);
      if (photoTable) setEditing(false);
    } catch {
      setSaveError("요금표를 저장하지 못했습니다. 입력 내용은 그대로 유지됩니다.");
    } finally {
      setSaving(false);
    }
  }, [draft, draftIssues, onSave, photoTable]);

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
    <div className="min-w-0" data-price-guide-detail-matrix="true">
      {photoTable && !editing ? (
        <PriceGuideStructuredReviewTable
          document={draft}
          onEdit={() => {
            setFocusFirstMissingDuration(false);
            setEditing(true);
          }}
          onSetAverageTime={() => {
            setFocusFirstMissingDuration(true);
            setEditing(true);
          }}
        />
      ) : (
        <PriceGuideNativeInlineTable
          document={draft}
          onChange={updateDraft}
          validationIssues={validationIssues}
          heading={photoTable ? "요금표 수정" : "요금표"}
          photoReviewMode={photoTable}
          focusFirstMissingDuration={focusFirstMissingDuration}
        />
      )}
      {saveError ? <p role="alert" className="mt-3 text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
      {editing ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={resetDraft}
          disabled={saving || !dirty}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />변경 취소
        </button>
        <button
          type="button"
          onClick={() => void saveDraft()}
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#172033] px-4 text-[14px] font-medium leading-5 text-white hover:bg-[#25314a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Check className="h-4 w-4" aria-hidden="true" />{saving ? "저장 중" : "상세 요금표 저장"}
        </button>
      </div> : null}
    </div>
  );
}
