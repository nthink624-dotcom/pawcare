"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  validatePriceGuideDocument,
  type PriceGuideValidationIssue,
} from "@/components/auth/signup-price-guide-editor";
import PriceGuideNativeInlineTable from "@/components/owner-web/price-guide-native-inline-table";
import PriceGuideStructuredReviewTable from "@/components/owner-web/price-guide-structured-review-table";
import { buildPriceGuideStructuredProjection } from "@/lib/price-guide-structured-table";
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
  const [editingTarget, setEditingTarget] = useState<{ kind: "group"; groupIndex: number } | { kind: "extras" } | null>(null);
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
    setEditingTarget(null);
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
    setEditingTarget(null);
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
      if (photoTable) {
        setEditing(false);
        setEditingTarget(null);
      }
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

  const structuredGroups = useMemo(() => buildPriceGuideStructuredProjection(draft).groups, [draft]);
  const editingHeading = editingTarget?.kind === "group"
    ? `${structuredGroups[editingTarget.groupIndex]?.label ?? "요금표"} 수정`
    : editingTarget?.kind === "extras"
      ? "추가요금 수정"
      : photoTable ? "요금표 수정" : "요금표";

  return (
    <div className="min-w-0" data-price-guide-detail-matrix="true">
      {photoTable ? (
        editing ? null : <PriceGuideStructuredReviewTable
          document={draft}
          onEditGroup={(groupIndex) => {
            setFocusFirstMissingDuration(false);
            setEditingTarget({ kind: "group", groupIndex });
            setEditing(true);
          }}
          onEditExtras={() => {
            setFocusFirstMissingDuration(false);
            setEditingTarget({ kind: "extras" });
            setEditing(true);
          }}
          onSetAverageTime={(groupIndex) => {
            setFocusFirstMissingDuration(true);
            setEditingTarget({ kind: "group", groupIndex });
            setEditing(true);
          }}
        />
      ) : (
        <PriceGuideNativeInlineTable
          document={draft}
          onChange={updateDraft}
          validationIssues={validationIssues}
          heading={editingHeading}
          photoReviewMode={photoTable}
          focusFirstMissingDuration={focusFirstMissingDuration}
          visibleGroupIndex={editingTarget?.kind === "group" ? editingTarget.groupIndex : undefined}
          extrasOnly={editingTarget?.kind === "extras"}
        />
      )}
      {photoTable && editing ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/40 p-3 sm:p-6" data-price-guide-group-edit-modal="true">
          <section role="dialog" aria-modal="true" aria-labelledby="price-guide-group-dialog-title" className="flex max-h-[calc(100dvh-24px)] w-full max-w-[1100px] min-w-0 flex-col overflow-hidden rounded-[14px] border border-[#dbe2ea] bg-white shadow-[0_24px_64px_rgba(15,23,42,0.24)] sm:max-h-[calc(100dvh-48px)]">
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-[#e5eaf0] px-4 py-2.5 sm:px-6">
              <h2 id="price-guide-group-dialog-title" className="min-w-0 text-[20px] font-semibold leading-7 text-[#172033]">{editingHeading}</h2>
              <button type="button" onClick={resetDraft} aria-label="수정 닫기" className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f1f5f9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb]"><X className="h-5 w-5" aria-hidden="true" /></button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-5">
              <PriceGuideNativeInlineTable
                document={draft}
                onChange={updateDraft}
                validationIssues={validationIssues}
                heading={editingHeading}
                photoReviewMode={photoTable}
                focusFirstMissingDuration={focusFirstMissingDuration}
                visibleGroupIndex={editingTarget?.kind === "group" ? editingTarget.groupIndex : undefined}
                extrasOnly={editingTarget?.kind === "extras"}
                hideHeader
              />
              {saveError ? <p role="alert" className="mt-3 text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
            </div>
            <footer className="grid shrink-0 gap-2 border-t border-[#e5eaf0] bg-white p-3 sm:grid-cols-2 sm:px-5">
              <button type="button" onClick={resetDraft} disabled={saving || !dirty} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] border border-[#cbd5e1] bg-white px-4 text-[14px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-50"><RotateCcw className="h-4 w-4" aria-hidden="true" />변경 취소</button>
              <button type="button" onClick={() => void saveDraft()} disabled={saving} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[8px] bg-[#172033] px-4 text-[14px] font-medium leading-5 text-white hover:bg-[#25314a] disabled:cursor-not-allowed disabled:opacity-60"><Check className="h-4 w-4" aria-hidden="true" />{saving ? "저장 중" : "저장"}</button>
            </footer>
          </section>
        </div>
      ) : null}
      {saveError && !(photoTable && editing) ? <p role="alert" className="mt-3 text-[13px] font-medium leading-5 text-[#a04455]">{saveError}</p> : null}
      {editing && !photoTable ? <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
