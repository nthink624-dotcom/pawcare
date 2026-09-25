"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { CalendarCareNoteInput } from "@/components/owner-web/calendar-care-note-input";
import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { normalizeStoredCareReport } from "@/lib/care-report-draft";

type DraftResponse = {
  draft: {
    reportText?: unknown;
    careReportPhotoConsent?: unknown;
    careReportOwnerConfirmedAt?: string | null;
  } | null;
};

export type CareReportPreviewFixture = {
  sourceText?: string;
  reportText?: string;
  revisionRequest?: string;
  savedReport?: boolean;
  errors?: {
    generation?: string;
    save?: string;
    send?: string;
  };
};

function AiGeneratingMessage({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex items-center justify-center px-4 py-6 text-[#5f6d7b]">
      <div className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[#526171]" />
        <span className="text-[16px] font-normal leading-6">AI가 케어리포트를 정리하고 있어요</span>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center gap-1 rounded-[8px] px-2 text-[16px] font-medium leading-6 text-[#526171] hover:bg-[#f3f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
        >
          <X className="h-4 w-4" /> 취소
        </button>
      </div>
    </div>
  );
}

function CareReportTextEditor({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [inputModality, setInputModality] = useState<"keyboard" | "pointer">("keyboard");
  const [focused, setFocused] = useState(false);

  function markKeyboardFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") setInputModality("keyboard");
  }

  function resetFocusAfterLeave(event: FocusEvent<HTMLDivElement>) {
    const scope = event.currentTarget;
    queueMicrotask(() => {
      if (!scope.contains(document.activeElement)) setInputModality("keyboard");
    });
  }

  return (
    <div
      data-textarea-input-modality={inputModality}
      onPointerDownCapture={() => setInputModality("pointer")}
      onMouseDownCapture={() => setInputModality("pointer")}
      onKeyDownCapture={markKeyboardFocus}
      onBlurCapture={resetFocusAfterLeave}
      className="relative"
    >
      <textarea
        data-care-report-editor
        data-modal-wheel-scope="self"
        value={value}
        onChange={(event) => onChange(event.target.value.slice(0, 4000))}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        maxLength={4000}
        aria-label="고객에게 보낼 케어리포트"
        className="min-h-[180px] w-full resize-y overflow-y-hidden rounded-[12px] border border-[#dde2e8] bg-white px-4 pb-8 pt-3 text-[16px] font-normal leading-6 text-[#1b2d43] [field-sizing:content] outline-none focus:outline-none focus:ring-0 disabled:bg-[#f8f9fa] disabled:opacity-60 sm:min-h-[220px]"
        style={focused && inputModality === "keyboard" ? { outline: "2px solid #2563eb", outlineOffset: 2 } : undefined}
      />
      <span className="pointer-events-none absolute bottom-2 right-3.5 rounded bg-white/90 px-1 text-[13px] font-normal leading-5 text-[#89939e]">
        {value.length}/4000
      </span>
    </div>
  );
}

export function CalendarCareReportCompletionPanel({
  shopId,
  appointmentId,
  hasRegisteredPhotos,
  previewMode: previewModeOverride,
  previewFixture,
  disabled,
  onPendingChange,
  onBeforePublish,
  onSaveDraft,
  onReportSent,
}: {
  shopId: string;
  appointmentId: string;
  details: GroomingCompletionDetails;
  currentWeightKg: string;
  onDetailsChange: (details: GroomingCompletionDetails) => void;
  hasRegisteredPhotos: boolean;
  serviceName?: string;
  previewMode?: boolean;
  previewFixture?: CareReportPreviewFixture;
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onBeforePublish?: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  onReportSent?: () => Promise<void> | void;
}) {
  const previewMode = previewModeOverride ?? false;
  const fixture = previewMode ? previewFixture : undefined;
  const [sourceText, setSourceText] = useState(fixture?.sourceText ?? "");
  const [reportText, setReportText] = useState(fixture?.reportText ?? "");
  const [revisionRequest, setRevisionRequest] = useState(fixture?.revisionRequest ?? "");
  const [savedReport, setSavedReport] = useState(fixture?.savedReport ?? false);
  const [generating, setGenerating] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
  const [generationError, setGenerationError] = useState(fixture?.errors?.generation ?? "");
  const [saveError, setSaveError] = useState(fixture?.errors?.save ?? "");
  const [sendError, setSendError] = useState(fixture?.errors?.send ?? "");
  const generationAbortRef = useRef<AbortController | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const saving = savingAction !== null;
  const pending = generating || saving;

  useEffect(() => {
    if (!previewMode) onPendingChange(pending);
  }, [onPendingChange, pending, previewMode]);

  useEffect(() => () => {
    generationAbortRef.current?.abort();
    if (!previewMode) onPendingChange(false);
  }, [onPendingChange, previewMode]);

  useEffect(() => {
    if (previewMode) return;
    setSourceText("");
    setReportText("");
    setRevisionRequest("");
    setSavedReport(false);
    setGenerationError("");
    setSaveError("");
    setSendError("");
    let active = true;
    const query = new URLSearchParams({ shopId, appointmentId });
    void fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, { cache: "no-store" })
      .then((response) => {
        if (!active || !response.draft) return;
        const normalized = normalizeStoredCareReport(response.draft.reportText);
        if (!normalized) return;
        setReportText(normalized.reportText);
        setSavedReport(true);
      })
      .catch(() => {
        // Completing grooming remains available when an optional draft cannot be loaded.
      });
    return () => {
      active = false;
    };
  }, [appointmentId, previewMode, shopId]);

  async function generateReport() {
    if (previewMode || disabled || generating) return;
    const isRevision = Boolean(reportText && revisionRequest.trim());
    if (!isRevision && !sourceText.trim()) {
      setGenerationError("오늘 관찰한 내용을 한 줄 이상 입력해 주세요.");
      return;
    }
    const controller = new AbortController();
    generationAbortRef.current = controller;
    setGenerating(true);
    setGenerationError("");
    try {
      const response = await fetchApiJsonWithAuth<{ reportText: string }>("/api/owner/care-reports", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          shopId,
          appointmentId,
          sourceText: isRevision ? "" : sourceText,
          currentReportText: isRevision ? reportText : undefined,
          revisionRequest: isRevision ? revisionRequest : undefined,
          photoConsent: hasRegisteredPhotos,
        }),
      });
      if (controller.signal.aborted) return;
      setReportText(response.reportText);
      setRevisionRequest("");
      setSavedReport(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setGenerationError(error instanceof Error ? error.message : "AI 케어리포트 초안을 만들지 못했습니다.");
      }
    } finally {
      if (generationAbortRef.current === controller) {
        generationAbortRef.current = null;
        setGenerating(false);
      }
    }
  }

  function cancelGeneration() {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setGenerating(false);
    setGenerationError("");
  }

  async function saveReportDraft() {
    if (previewMode || disabled || saving || !reportText.trim() || saveInFlightRef.current) return saveInFlightRef.current;
    const savePromise = (async () => {
      setSavingAction("draft");
      setSaveError("");
      try {
        await fetchApiJsonWithAuth("/api/owner/care-reports", {
          method: "PATCH",
          body: JSON.stringify({ shopId, appointmentId, reportText, photoConsent: hasRegisteredPhotos, action: "save_draft" }),
        });
        const query = new URLSearchParams({ shopId, appointmentId });
        const reloaded = await fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, { cache: "no-store" });
        if (reloaded.draft?.reportText !== reportText || reloaded.draft.careReportPhotoConsent !== hasRegisteredPhotos) {
          throw new Error("저장된 케어리포트가 아직 일치하지 않습니다. 입력은 보존했으니 다시 저장해 주세요.");
        }
        await onSaveDraft?.();
        setSavedReport(true);
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : "케어리포트 초안을 임시저장하지 못했습니다.");
      } finally {
        setSavingAction(null);
      }
    })();
    saveInFlightRef.current = savePromise;
    void savePromise.finally(() => {
      if (saveInFlightRef.current === savePromise) saveInFlightRef.current = null;
    });
    return savePromise;
  }

  async function publishReport() {
    if (previewMode || !reportText.trim() || !savedReport || disabled || saving) return;
    setSavingAction("publish");
    setSendError("");
    try {
      await onBeforePublish?.();
      await fetchApiJsonWithAuth("/api/owner/care-reports", {
        method: "PATCH",
        body: JSON.stringify({ shopId, appointmentId, reportText, photoConsent: hasRegisteredPhotos, action: "publish" }),
      });
      await onReportSent?.();
    } catch (error) {
      setSendError(error instanceof Error ? error.message : "케어리포트를 보내지 못했습니다.");
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <section>
      {previewMode ? (
        <p role="status" className="mb-3 rounded-[10px] border border-[#e3d4bc] bg-white px-4 py-3 text-[16px] font-normal leading-6 text-[#745b38]">
          미리보기에서는 AI 생성·저장·전송을 사용할 수 없습니다.
        </p>
      ) : null}
      <div inert={previewMode ? true : undefined} aria-disabled={previewMode || disabled || undefined}>
        <CalendarCareNoteInput
          value={sourceText}
          onChange={setSourceText}
          onSubmit={() => void generateReport()}
          submitLabel="AI 초안 만들기"
          submitting={generating && !reportText}
          disabled={previewMode || disabled}
        />

        {generating ? <AiGeneratingMessage onCancel={cancelGeneration} /> : null}

        {reportText ? (
          <div data-care-report-result-area className="mt-4 space-y-3">
            <CareReportTextEditor
              value={reportText}
              disabled={disabled || saving}
              onChange={(value) => {
                setReportText(value);
                setSavedReport(false);
              }}
            />
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
              <input
                value={revisionRequest}
                onChange={(event) => setRevisionRequest(event.target.value.slice(0, 1000))}
                maxLength={1000}
                aria-label="케어리포트 수정 요청"
                placeholder="수정할 내용을 적어 주세요"
                className="min-h-11 min-w-0 rounded-[10px] border border-[#d7dde4] bg-white px-3 text-[16px] font-normal leading-6 text-[#263547] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
              />
              <button
                type="button"
                onClick={() => void generateReport()}
                disabled={!revisionRequest.trim() || disabled || saving || generating}
                className="inline-flex min-h-11 items-center justify-center rounded-[10px] border border-[#d5dbe2] bg-white px-4 text-[16px] font-medium leading-6 text-[#526171] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
              >
                전체 다시 작성
              </button>
            </div>
          </div>
        ) : null}

        <div className="sticky bottom-0 z-[95] -mx-2 mt-2 rounded-b-[20px] border-t border-[#dde2e8] bg-white/95 px-3 py-2 shadow-[0_-10px_28px_rgba(20,39,63,0.07)] backdrop-blur">
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void publishReport()}
              disabled={!reportText.trim() || !savedReport || disabled || saving}
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#2f6fd6] text-[16px] font-medium leading-6 text-white shadow-[0_7px_18px_rgba(47,111,214,0.18)] transition hover:bg-[#245fbd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {savingAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              확정하여 보내기
            </button>
            <button
              type="button"
              onClick={() => void saveReportDraft()}
              disabled={!reportText.trim() || disabled || saving}
              aria-label="케어리포트 임시저장"
              className="inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#d5dbe2] bg-white text-[16px] font-medium leading-6 text-[#526171] transition hover:bg-[#f3f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
            >
              {savingAction === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              임시저장
            </button>
          </div>
        </div>

        <div aria-live="assertive" aria-atomic="true">
          {generationError ? <p data-care-report-generation-error className="mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[16px] font-normal leading-6 text-[#a04455]">{generationError}</p> : null}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {saveError ? <p data-care-report-save-error className="mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[16px] font-normal leading-6 text-[#a04455]">{saveError}</p> : null}
        </div>
        <div aria-live="assertive" aria-atomic="true">
          {sendError ? <p data-care-report-send-error className="mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[16px] font-normal leading-6 text-[#a04455]">{sendError}</p> : null}
        </div>
      </div>
    </section>
  );
}
