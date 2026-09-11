"use client";

import { CheckCircle2, ChevronDown, ChevronUp, Loader2, X } from "lucide-react";
import { type FocusEvent, type KeyboardEvent, useEffect, useRef, useState } from "react";

import { CalendarCareNoteInput } from "@/components/owner-web/calendar-care-note-input";
import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { CARE_REPORT_TYPOGRAPHY as OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  CARE_REPORT_GENERATION_RETRY_MESSAGE,
  buildPreviewCareReportDraft,
  createCareReportSourceFacts,
  hasCareReportExactSourceEcho,
  isCareReportDraftUnchanged,
  matchesCanonicalCareReportSave,
  normalizeCareReportComparisonText,
  prepareCareReportSourceText,
  serializeCareReportSavePayload,
} from "@/lib/care-report-draft";
import {
  careReportDraftSchema,
  careReportGenerationMetadataSchema,
  careReportObservationsSchema,
  type CareReportDraft,
  type CareReportGenerationMetadata,
  type CareReportObservations,
  type CareReportSourceFactCitation,
  type CareReportSourceFact,
} from "@/types/care-report";

type DraftResponse = {
  draft: {
    careReportAiDraft?: unknown;
    careReportObservations?: unknown;
    careReportVoiceTranscript?: unknown;
    careReportPhotoConsent?: unknown;
    careReportOwnerConfirmedAt?: string | null;
  } | null;
};

function buildObservations(
  details: GroomingCompletionDetails,
  sourceFacts: CareReportSourceFact[],
  generation?: CareReportGenerationMetadata,
  sourceFactCitations: CareReportSourceFactCitation[] = [],
  saveRequestId?: string,
  savePayloadFingerprint?: string,
): CareReportObservations {
  const customNote = [
    details.nextRecommendedVisitDate ? `다음 권장 방문일: ${details.nextRecommendedVisitDate}` : "",
  ].filter(Boolean).join("\n").slice(0, 1000);

  return {
    coat: [],
    skin: [],
    ears: [],
    pawsAndNails: [],
    groomingResponse: [],
    customNote,
    sourceFacts,
    sourceFactCitations,
    sourceVersion: "care-report-v2",
    ...(generation ? { generation } : {}),
    ...(saveRequestId ? { saveRequestId } : {}),
    ...(savePayloadFingerprint ? { savePayloadFingerprint } : {}),
  };
}

type SaveIdentity = {
  payload: string;
  requestId: string;
  observations: CareReportObservations;
  sourceText: string;
  photoConsent: boolean;
  report: CareReportDraft;
  savePayloadFingerprint?: string;
};

type CareReportResultState = {
  appointmentId: string;
  sourceText: string;
  value: CareReportDraft;
};

type CareReportComposerState = {
  appointmentId: string;
  value: string;
};

function validateGeneratedCareReport(
  sourceText: string,
  nextReport: CareReportDraft,
  currentReport?: CareReportDraft,
) {
  if (
    hasCareReportExactSourceEcho(sourceText, nextReport) ||
    (currentReport && isCareReportDraftUnchanged(currentReport, nextReport))
  ) {
    throw new Error(CARE_REPORT_GENERATION_RETRY_MESSAGE);
  }
  return nextReport;
}

function matchesCanonicalSave(response: DraftResponse, identity: SaveIdentity) {
  if (!response.draft) return false;
  const report = careReportDraftSchema.safeParse(response.draft.careReportAiDraft);
  const observations = careReportObservationsSchema.safeParse(response.draft.careReportObservations);
  const expectedObservations = careReportObservationsSchema.safeParse({
    ...identity.observations,
    saveRequestId: identity.requestId,
    savePayloadFingerprint: identity.savePayloadFingerprint,
  });
  return report.success && observations.success && expectedObservations.success &&
    typeof response.draft.careReportPhotoConsent === "boolean" &&
    matchesCanonicalCareReportSave({
      expected: {
        careReport: identity.report,
        observations: expectedObservations.data,
        sourceText: identity.sourceText,
        photoConsent: identity.photoConsent,
      },
      actual: {
        careReport: report.data,
        observations: observations.data,
        sourceText: typeof response.draft.careReportVoiceTranscript === "string" ? response.draft.careReportVoiceTranscript : "",
        photoConsent: response.draft.careReportPhotoConsent,
      },
    });
}

const previewAutomaticFacts = {
  petName: "두부",
  actualDurationMinutes: 125,
};

function buildPreviewReport(
  details: GroomingCompletionDetails,
  serviceName: string,
  ownerSourceText: string,
  sourceFacts: CareReportSourceFact[],
  currentDraft?: CareReportDraft,
): CareReportDraft {
  const observations = buildObservations(details, sourceFacts);
  return buildPreviewCareReportDraft({
    petName: previewAutomaticFacts.petName,
    serviceName: serviceName || "예약한 미용",
    actualDurationMinutes: previewAutomaticFacts.actualDurationMinutes,
    nextRecommendedVisitDate: details.nextRecommendedVisitDate,
    ownerSourceText,
    observations,
    currentDraft,
  });
}

function AiGeneratingMessage({ onCancel }: { onCancel: () => void }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-[14px] border border-[#dde2e8] bg-white text-[#5f6d7b] sm:min-h-[220px]">
      <div className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[#526171]" />
        <span className={OWNER_TYPOGRAPHY.body}>AI가 케어리포트를 정리하고 있어요</span>
        <button
          type="button"
          onClick={onCancel}
          className={`${OWNER_TYPOGRAPHY.label} inline-flex min-h-11 items-center gap-1 rounded-[8px] px-2 text-[#526171] hover:bg-[#f3f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]`}
        >
          <X className="h-4 w-4" /> 취소
        </button>
      </div>
    </div>
  );
}

function EmptyReportMessage() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className={`${OWNER_TYPOGRAPHY.meta} break-keep text-[#526171] [line-height:1.4]`}>AI가 정리한 내용</p>
        <span className={`${OWNER_TYPOGRAPHY.badge} whitespace-nowrap rounded-full bg-[#f0f2f4] px-2.5 py-1 text-[#697582] [line-height:1.4]`}>작성 전</span>
      </div>
      <div data-care-report-editor-empty className={`${OWNER_TYPOGRAPHY.body} mt-2 flex min-h-[180px] items-center justify-center rounded-[12px] border border-[#e0e4e9] bg-[#f8f9fa] px-4 text-center text-[#87919c] [line-height:1.5] sm:min-h-[220px]`}>
        아래에 케어 내용을 남기면 이곳에 정리됩니다.
      </div>
    </div>
  );
}

function AiPolishedMessage({
  report,
  matchesCurrentSource,
  disabled,
  onReportChange,
}: {
  report: CareReportDraft;
  matchesCurrentSource: boolean;
  disabled?: boolean;
  onReportChange: (report: CareReportDraft) => void;
}) {
  const [textareaInputModality, setTextareaInputModality] = useState<"keyboard" | "pointer">("keyboard");
  const [textareaFocused, setTextareaFocused] = useState(false);

  function markKeyboardTextareaFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Tab") setTextareaInputModality("keyboard");
  }

  function resetTextareaFocusAfterLeave(event: FocusEvent<HTMLDivElement>) {
    const scope = event.currentTarget;
    queueMicrotask(() => {
      if (!scope.contains(document.activeElement)) setTextareaInputModality("keyboard");
    });
  }

  const textareaFocusStyle = textareaFocused && textareaInputModality === "keyboard"
    ? { outline: "2px solid #2563eb", outlineOffset: 2 }
    : undefined;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className={`${OWNER_TYPOGRAPHY.meta} break-keep text-[#526171] [line-height:1.4]`}>AI가 정리한 문장</p>
        <span className={`${OWNER_TYPOGRAPHY.badge} break-keep rounded-full bg-[#f0f2f4] px-2.5 py-1 text-[#596775] [line-height:1.4]`}>
          {matchesCurrentSource ? "직접 수정 가능" : "이전 초안 · 다시 생성 필요"}
        </span>
      </div>
      <div
        data-textarea-input-modality={textareaInputModality}
        onPointerDownCapture={() => setTextareaInputModality("pointer")}
        onMouseDownCapture={() => setTextareaInputModality("pointer")}
        onKeyDownCapture={markKeyboardTextareaFocus}
        onBlurCapture={resetTextareaFocusAfterLeave}
        className="relative mt-2"
      >
        <textarea
          data-modal-wheel-scope="self"
          value={report.oneLineSummary}
          onChange={(event) => onReportChange({ ...report, oneLineSummary: event.target.value.slice(0, 400) })}
          onFocus={() => setTextareaFocused(true)}
          onBlur={() => setTextareaFocused(false)}
          disabled={disabled}
          maxLength={400}
          aria-label="AI가 정리한 문장 편집"
          data-care-report-editor
          className={`${OWNER_TYPOGRAPHY.body} min-h-[180px] w-full resize-y overflow-y-hidden rounded-[10px] border border-[#dde2e8] bg-[#fafbfc] px-3.5 pb-7 pt-2.5 text-[#1b2d43] [field-sizing:content] outline-none focus:outline-none focus:ring-0 disabled:opacity-60 sm:min-h-[220px]`}
          style={textareaFocusStyle}
        />
        <span className={`${OWNER_TYPOGRAPHY.helper} pointer-events-none absolute bottom-2 right-3.5 rounded bg-[#fafbfc]/90 px-1 text-[#89939e]`}>
          {report.oneLineSummary.length}/400
        </span>
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block min-w-0">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#526171]`}>관찰 내용</span>
          <textarea
            value={[report.conditionSummary, report.groomingResponse].filter(Boolean).join("\n")}
            onChange={(event) => {
              const [conditionSummary = "", groomingResponse = ""] = event.target.value.split("\n", 2);
              onReportChange({ ...report, conditionSummary, groomingResponse });
            }}
            disabled={disabled}
            aria-label="관찰 내용 편집"
            className={`${OWNER_TYPOGRAPHY.body} mt-1.5 min-h-11 w-full resize-y overflow-y-hidden rounded-[10px] border border-[#dde2e8] bg-[#fafbfc] px-3 py-2 text-[#1b2d43] [field-sizing:content] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-60`}
          />
        </label>
        <label className="block min-w-0">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#526171]`}>집에서 참고할 점</span>
          <textarea
            value={report.homeCareTips.join("\n")}
            onChange={(event) => onReportChange({
              ...report,
              homeCareTips: event.target.value.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 4),
            })}
            disabled={disabled}
            aria-label="집에서 참고할 점 편집"
            className={`${OWNER_TYPOGRAPHY.body} mt-1.5 min-h-11 w-full resize-y overflow-y-hidden rounded-[10px] border border-[#dde2e8] bg-[#fafbfc] px-3 py-2 text-[#1b2d43] [field-sizing:content] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-60`}
          />
        </label>
      </div>
    </div>
  );
}

export function CalendarCareReportCompletionPanel({
  shopId,
  appointmentId,
  details,
  currentWeightKg,
  hasRegisteredPhotos,
  serviceName = "",
  previewMode: previewModeOverride,
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
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onBeforePublish?: () => Promise<void> | void;
  onSaveDraft?: () => Promise<void> | void;
  onReportSent?: () => Promise<void> | void;
}) {
  const [reportState, setReportState] = useState<CareReportResultState | null>(null);
  const [savedReport, setSavedReport] = useState(false);
  const [, setConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [composerState, setComposerState] = useState<CareReportComposerState>({ appointmentId, value: "" });
  const [sourceFacts, setSourceFacts] = useState<CareReportSourceFact[]>([]);
  const [sourceFactCitations, setSourceFactCitations] = useState<CareReportSourceFactCitation[]>([]);
  const [generation, setGeneration] = useState<CareReportGenerationMetadata | null>(null);
  const [sourceExpanded, setSourceExpanded] = useState(false);
  const generationAbortRef = useRef<AbortController | null>(null);
  const activeGenerationIdRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Promise<void> | null>(null);
  const saveIdentityRef = useRef<SaveIdentity | null>(null);
  const committedSaveRef = useRef<SaveIdentity | null>(null);
  const previewMode = previewModeOverride ?? (typeof window !== "undefined" && (/^\/demo(?:\/|$)/.test(window.location.pathname) || /^\/dev(?:\/|$)/.test(window.location.pathname)));
  const report = reportState?.appointmentId === appointmentId ? reportState.value : null;
  const reportSourceText = reportState?.appointmentId === appointmentId ? reportState.sourceText : "";
  const composerValue = composerState.appointmentId === appointmentId ? composerState.value : "";
  const reportMatchesComposer = Boolean(report) &&
    normalizeCareReportComparisonText(reportSourceText) === normalizeCareReportComparisonText(composerValue);
  const saving = savingAction !== null;
  const pending = generating || saving;

  function storeReport(nextReport: CareReportDraft, sourceText = reportSourceText) {
    setReportState({ appointmentId, sourceText, value: nextReport });
  }

  function setComposerValue(value: string) {
    setComposerState({ appointmentId, value });
  }

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  useEffect(() => () => {
    generationAbortRef.current?.abort();
    onPendingChange(false);
  }, [onPendingChange]);

  useEffect(() => {
    setSavedReport(false);
    setError("");
    setSourceFacts([]);
    setSourceFactCitations([]);
    setGeneration(null);
    activeGenerationIdRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setGenerating(false);
  }, [appointmentId]);

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    const query = new URLSearchParams({ shopId, appointmentId });
    void fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, { cache: "no-store" })
      .then((response) => {
        if (!active || !response.draft) return;
        const hydratedSourceText = typeof response.draft.careReportVoiceTranscript === "string"
          ? response.draft.careReportVoiceTranscript
          : "";
        setComposerValue(hydratedSourceText);
        const parsed = careReportDraftSchema.safeParse(response.draft.careReportAiDraft);
        if (!parsed.success) return;
        if (hasCareReportExactSourceEcho(hydratedSourceText, parsed.data)) {
          setError(CARE_REPORT_GENERATION_RETRY_MESSAGE);
          return;
        }
        setReportState({ appointmentId, sourceText: hydratedSourceText, value: parsed.data });
        setSavedReport(true);
        const observations = careReportObservationsSchema.safeParse(response.draft.careReportObservations);
        if (observations.success) {
          setSourceFacts(observations.data.sourceFacts);
          setSourceFactCitations(observations.data.sourceFactCitations);
          const metadata = careReportGenerationMetadataSchema.safeParse(observations.data.generation);
          setGeneration(metadata.success ? metadata.data : null);
        }
        setConfirmed(Boolean(response.draft.careReportOwnerConfirmedAt));
      })
      .catch(() => {
        // 기본 미용 완료는 케어리포트 조회 실패와 무관하게 계속할 수 있습니다.
      });
    return () => {
      active = false;
    };
  }, [appointmentId, previewMode, shopId]);

  function editReport(next: CareReportDraft) {
    storeReport(next);
    setSavedReport(false);
    setConfirmed(false);
  }

  async function generateReport() {
    if (disabled || generating) return;
    let sourceText: string;
    try {
      sourceText = prepareCareReportSourceText(composerValue);
    } catch (sourceError) {
      setError(sourceError instanceof Error ? sourceError.message : "관찰 메모를 확인해 주세요.");
      return;
    }
    if (!sourceText) {
      setError("오늘 관찰한 내용을 한 줄 이상 입력해 주세요.");
      return;
    }
    const nextSourceFacts = createCareReportSourceFacts(sourceText);
    const generationId = `generation-${crypto.randomUUID().replaceAll("_", "-")}`;
    const controller = new AbortController();
    generationAbortRef.current = controller;
    activeGenerationIdRef.current = generationId;
    setSourceFacts(nextSourceFacts);
    setGenerating(true);
    setError("");
    try {
      if (previewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        if (activeGenerationIdRef.current !== generationId) return;
        const nextReport = validateGeneratedCareReport(
          sourceText,
          buildPreviewReport(details, serviceName, sourceText, nextSourceFacts, report ?? undefined),
          report ?? undefined,
        );
        storeReport(nextReport, sourceText);
        setSavedReport(false);
        setConfirmed(false);
        return;
      }
      const response = await fetchApiJsonWithAuth<{
        careReport: CareReportDraft;
        generation: CareReportGenerationMetadata;
        sourceFactCitations?: CareReportSourceFactCitation[];
      }>("/api/owner/care-reports", {
        method: "POST",
        signal: controller.signal,
        body: JSON.stringify({
          shopId,
          appointmentId,
          observations: buildObservations(details, nextSourceFacts),
          voiceTranscript: sourceText,
          photoConsent: hasRegisteredPhotos,
          clientGenerationId: generationId,
          currentDraft: report ?? undefined,
        }),
      });
      if (activeGenerationIdRef.current !== generationId) return;
      const nextReport = validateGeneratedCareReport(
        sourceText,
        careReportDraftSchema.parse(response.careReport),
        report ?? undefined,
      );
      storeReport(nextReport, sourceText);
      setGeneration(careReportGenerationMetadataSchema.parse(response.generation));
      setSourceFactCitations(response.sourceFactCitations ?? []);
      setSavedReport(false);
      setConfirmed(false);
    } catch (generationError) {
      if (controller.signal.aborted) return;
      setError(generationError instanceof Error ? generationError.message : "AI 케어리포트 초안을 만들지 못했습니다.");
    } finally {
      if (activeGenerationIdRef.current === generationId) {
      setGenerating(false);
        generationAbortRef.current = null;
      }
    }
  }

  function submitOwnerMessage() {
    if (disabled || generating) return;
    void generateReport();
  }

  function cancelGeneration() {
    activeGenerationIdRef.current = null;
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setGenerating(false);
    setError("");
  }

  async function saveReportDraft() {
    if (disabled || saving || !report || !reportMatchesComposer || saveInFlightRef.current) return saveInFlightRef.current;
    const savePromise = (async () => {
      setSavingAction("draft");
      setError("");
      try {
        if (!previewMode) {
          const sourceText = prepareCareReportSourceText(composerValue);
          const baseObservations = buildObservations(
            details,
            sourceFacts,
            generation ?? undefined,
            sourceFactCitations,
          );
          const payload = serializeCareReportSavePayload({
            careReport: report,
            observations: baseObservations,
            sourceText,
            photoConsent: hasRegisteredPhotos,
          });
          let identity = saveIdentityRef.current;
          if (!identity || identity.payload !== payload) {
            identity = {
              payload,
              requestId: `save-${crypto.randomUUID().replaceAll("_", "-")}`,
              observations: baseObservations,
              sourceText,
              photoConsent: hasRegisteredPhotos,
              report,
            };
            saveIdentityRef.current = identity;
            committedSaveRef.current = null;
          }

          if (committedSaveRef.current?.payload !== payload) {
            const saved = await fetchApiJsonWithAuth<{ savePayloadFingerprint: string }>("/api/owner/care-reports", {
              method: "PATCH",
              body: JSON.stringify({
                shopId,
                appointmentId,
                careReport: report,
                careReportObservations: buildObservations(
                  details,
                  sourceFacts,
                  generation ?? undefined,
                  sourceFactCitations,
                  identity.requestId,
                ),
                careReportSourceText: sourceText,
                saveRequestId: identity.requestId,
                photoConsent: hasRegisteredPhotos,
                action: "save_draft",
              }),
            });
            identity = { ...identity, savePayloadFingerprint: saved.savePayloadFingerprint };
            saveIdentityRef.current = identity;
            committedSaveRef.current = identity;
          }
          const query = new URLSearchParams({ shopId, appointmentId });
          const reloaded = await fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, { cache: "no-store" });
          if (!matchesCanonicalSave(reloaded, identity)) {
            throw new Error("저장된 케어리포트가 아직 일치하지 않습니다. 입력은 보존했으니 잠시 후 다시 확인해 주세요.");
          }
        }
        await onSaveDraft?.();
        setSavedReport(true);
        setConfirmed(false);
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "케어리포트 초안을 임시저장하지 못했습니다.");
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
    if (!report || !reportMatchesComposer || disabled || saving) return;
    setSavingAction("publish");
    setError("");
    try {
      await onBeforePublish?.();
      if (previewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        setConfirmed(true);
        await onReportSent?.();
        return;
      }
      await fetchApiJsonWithAuth("/api/owner/care-reports", {
        method: "PATCH",
        body: JSON.stringify({
          shopId,
          appointmentId,
          careReport: report,
          photoConsent: hasRegisteredPhotos,
          action: "publish",
        }),
      });
      setConfirmed(true);
      await onReportSent?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "케어리포트를 보내지 못했습니다.");
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <section>
      <div>
        <div data-care-report-result-area className="min-h-[180px] space-y-2 sm:min-h-[220px]">
          {!report && !generating ? <EmptyReportMessage /> : null}

          {generating ? <AiGeneratingMessage onCancel={cancelGeneration} /> : null}

          {report ? (
            <AiPolishedMessage
              report={report}
              matchesCurrentSource={reportMatchesComposer}
              disabled={disabled || saving}
              onReportChange={editReport}
            />
          ) : null}
        </div>

        {report && composerValue.trim() ? (
          <div className="mt-2 rounded-[10px] border border-[#e0e5ea] bg-[#fafbfc] px-3">
            <button
              type="button"
              onClick={() => setSourceExpanded((current) => !current)}
              aria-expanded={sourceExpanded}
              className={`${OWNER_TYPOGRAPHY.label} flex min-h-11 w-full items-center justify-between gap-2 text-left text-[#526171] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]`}
            >
              <span>입력한 관찰 메모</span>
              {sourceExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {sourceExpanded ? <p className={`${OWNER_TYPOGRAPHY.body} border-t border-[#e4e8ed] py-2 text-[#405164]`}>{composerValue}</p> : null}
          </div>
        ) : null}

        <div className="sticky bottom-0 z-[95] -mx-2 mt-2 rounded-b-[20px] border-t border-[#dde2e8] bg-white/95 px-3 py-2 shadow-[0_-10px_28px_rgba(20,39,63,0.07)] backdrop-blur">
          <CalendarCareNoteInput
            value={composerValue}
            onChange={setComposerValue}
            onSubmit={submitOwnerMessage}
            submitting={generating}
            disabled={disabled}
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void publishReport()}
              disabled={!report || !reportMatchesComposer || !savedReport || disabled || saving}
              className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] bg-[#2f6fd6] text-white shadow-[0_7px_18px_rgba(47,111,214,0.18)] transition hover:bg-[#245fbd] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-not-allowed disabled:opacity-40`}
            >
              {savingAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              리포트 보내기
            </button>
            <button
              type="button"
              onClick={() => void saveReportDraft()}
              disabled={!report || !reportMatchesComposer || disabled || saving}
              aria-label="케어리포트 임시저장"
              className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#d5dbe2] bg-white text-[#526171] transition hover:bg-[#f3f5f7] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50`}
            >
              {savingAction === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              임시저장
            </button>
          </div>
        </div>

        {error ? <p className={`${OWNER_TYPOGRAPHY.label} mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[#a04455]`}>{error}</p> : null}
      </div>
    </section>
  );
}
