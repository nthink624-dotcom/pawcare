"use client";

import { CheckCircle2, Loader2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { CalendarCareNoteInput } from "@/components/owner-web/calendar-care-note-input";
import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { CARE_REPORT_TYPOGRAPHY as OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { buildPreviewCareReportDraft } from "@/lib/care-report-draft";
import { careReportDraftSchema, type CareReportDraft, type CareReportObservations } from "@/types/care-report";

type DraftResponse = {
  draft: {
    careReportAiDraft?: unknown;
    careReportOwnerConfirmedAt?: string | null;
  } | null;
};

function linesContaining(lines: string[], keywords: string[]) {
  return lines
    .filter((line) => keywords.some((keyword) => line.includes(keyword)))
    .slice(0, 8)
    .map((line) => line.slice(0, 80));
}

function buildObservations(details: GroomingCompletionDetails, ownerSourceText: string): CareReportObservations {
  const publicLines = ownerSourceText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);
  const customNote = [
    details.nextRecommendedVisitDate ? `다음 권장 방문일: ${details.nextRecommendedVisitDate}` : "",
  ].filter(Boolean).join("\n").slice(0, 1000);

  return {
    coat: linesContaining(publicLines, ["털", "엉킴", "모질"]),
    skin: linesContaining(publicLines, ["피부"]),
    ears: linesContaining(publicLines, ["귀"]),
    pawsAndNails: linesContaining(publicLines, ["발", "발톱", "발바닥"]),
    groomingResponse: linesContaining(publicLines, ["예민", "반응", "긴장", "편안"]),
    customNote,
  };
}

const previewAutomaticFacts = {
  petName: "두부",
  actualDurationMinutes: 125,
};

function buildPreviewReport(
  details: GroomingCompletionDetails,
  serviceName: string,
  ownerSourceText: string,
  currentDraft?: CareReportDraft,
): CareReportDraft {
  const observations = buildObservations(details, ownerSourceText);
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

function AiGeneratingMessage() {
  return (
    <div className="flex h-[110px] items-center justify-center rounded-[14px] border border-[#dde2e8] bg-white text-[#5f6d7b]">
      <div className="inline-flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-[#526171]" />
        <span className={OWNER_TYPOGRAPHY.body}>AI가 케어리포트를 정리하고 있어요</span>
      </div>
    </div>
  );
}

function EmptyReportMessage() {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className={`${OWNER_TYPOGRAPHY.meta} flex items-center gap-1.5 text-[#526171]`}>
          <Sparkles className="h-3.5 w-3.5" /> AI가 정리한 내용
        </p>
        <span className={`${OWNER_TYPOGRAPHY.badge} rounded-full bg-[#f0f2f4] px-2.5 py-1 text-[#697582]`}>작성 전</span>
      </div>
      <div className={`${OWNER_TYPOGRAPHY.body} mt-2 flex h-[58px] items-center justify-center rounded-[12px] border border-[#e0e4e9] bg-[#f8f9fa] px-4 text-center text-[#87919c]`}>
        아래에 케어 내용을 남기면 이곳에 정리됩니다.
      </div>
    </div>
  );
}

function AiPolishedMessage({
  content,
  disabled,
  onChange,
}: {
  content: string;
  disabled?: boolean;
  onChange: (content: string) => void;
}) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-3">
        <p className={`${OWNER_TYPOGRAPHY.meta} flex items-center gap-1.5 text-[#526171]`}>
          <Sparkles className="h-3.5 w-3.5" /> AI가 정리한 문장
        </p>
        <span className={`${OWNER_TYPOGRAPHY.badge} rounded-full bg-[#f0f2f4] px-2.5 py-1 text-[#596775]`}>직접 수정 가능</span>
      </div>
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value.slice(0, 280))}
        disabled={disabled}
        maxLength={280}
        aria-label="AI가 정리한 문장 편집"
        className={`${OWNER_TYPOGRAPHY.body} mt-2 h-[88px] max-h-[88px] w-full resize-none overflow-y-auto rounded-[10px] border border-[#dde2e8] bg-[#fafbfc] px-3.5 py-2.5 text-[#1b2d43] outline-none focus:border-[#8c99a7] focus:ring-2 focus:ring-[#e2e6eb] disabled:opacity-60`}
      />
      <div className="mt-1.5 flex justify-end">
        <span className={`${OWNER_TYPOGRAPHY.helper} text-[#89939e]`}>{content.length}/280</span>
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
  disabled,
  onPendingChange,
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
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onSaveDraft?: () => Promise<void> | void;
  onReportSent?: () => Promise<void> | void;
}) {
  const [report, setReport] = useState<CareReportDraft | null>(null);
  const [, setConfirmed] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const previewMode = typeof window !== "undefined" && (/^\/demo(?:\/|$)/.test(window.location.pathname) || /^\/dev(?:\/|$)/.test(window.location.pathname));
  const saving = savingAction !== null;
  const pending = generating || saving;

  useEffect(() => {
    onPendingChange(pending);
  }, [onPendingChange, pending]);

  useEffect(() => () => onPendingChange(false), [onPendingChange]);

  useEffect(() => {
    if (previewMode) return;
    let active = true;
    const query = new URLSearchParams({ shopId, appointmentId });
    void fetchApiJsonWithAuth<DraftResponse>(`/api/owner/grooming-record-drafts?${query.toString()}`, { cache: "no-store" })
      .then((response) => {
        if (!active || !response.draft) return;
        const parsed = careReportDraftSchema.safeParse(response.draft.careReportAiDraft);
        if (!parsed.success) return;
        setReport(parsed.data);
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
    setReport(next);
    setConfirmed(false);
  }

  async function generateReport(transientInput = "") {
    if (disabled || generating) return;
    setGenerating(true);
    setError("");
    try {
      if (previewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setReport(buildPreviewReport(details, serviceName, transientInput, report ?? undefined));
        setConfirmed(false);
        return;
      }
      const response = await fetchApiJsonWithAuth<{ careReport: CareReportDraft }>("/api/owner/care-reports", {
        method: "POST",
        body: JSON.stringify({
          shopId,
          appointmentId,
          observations: buildObservations(details, transientInput),
          voiceTranscript: transientInput,
          currentDraft: report ?? undefined,
          photoConsent: hasRegisteredPhotos,
          currentWeightKg: currentWeightKg.trim() ? Number(currentWeightKg) : undefined,
        }),
      });
      setReport(careReportDraftSchema.parse(response.careReport));
      setConfirmed(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "AI 케어리포트 초안을 만들지 못했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  function submitOwnerMessage() {
    if (disabled || generating) return;
    const message = composerValue.trim();
    if (!message) {
      if (!report) void generateReport();
      return;
    }

    setComposerValue("");
    void generateReport(message);
  }

  async function saveReportDraft() {
    if (disabled || saving) return;
    setSavingAction("draft");
    setError("");
    try {
      if (report && !previewMode) {
        await fetchApiJsonWithAuth("/api/owner/care-reports", {
          method: "PATCH",
          body: JSON.stringify({
            shopId,
            appointmentId,
            careReport: report,
            photoConsent: hasRegisteredPhotos,
            action: "save_draft",
          }),
        });
      }
      await onSaveDraft?.();
      setConfirmed(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "케어리포트 초안을 임시저장하지 못했습니다.");
    } finally {
      setSavingAction(null);
    }
  }

  async function publishReport() {
    if (!report || disabled || saving) return;
    setSavingAction("publish");
    setError("");
    try {
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
    <section className="pb-14">
      <div>
        <div className="max-h-[170px] space-y-2 overflow-y-auto overscroll-contain pr-1">
          {!report && !generating ? <EmptyReportMessage /> : null}

          {generating ? <AiGeneratingMessage /> : null}

          {report ? (
            <AiPolishedMessage
              content={report.oneLineSummary}
              disabled={disabled || saving}
              onChange={(content) => editReport({ ...report, oneLineSummary: content })}
            />
          ) : null}
        </div>

        <div className="mt-2">
          <CalendarCareNoteInput
            value={composerValue}
            onChange={setComposerValue}
            onSubmit={submitOwnerMessage}
            submitting={generating}
            disabled={disabled}
          />
        </div>

        <div className="fixed bottom-2 left-1/2 z-[95] grid w-[calc(100%-16px)] max-w-[520px] -translate-x-1/2 grid-cols-2 gap-2 rounded-b-[20px] border-t border-[#dde2e8] bg-white/95 px-3 py-2 shadow-[0_-10px_28px_rgba(20,39,63,0.07)] backdrop-blur sm:bottom-4">
          <button
            type="button"
            onClick={() => void publishReport()}
            disabled={!report || disabled || saving}
            className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] bg-[#2f6fd6] text-white shadow-[0_7px_18px_rgba(47,111,214,0.18)] transition hover:bg-[#245fbd] disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {savingAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            리포트 보내기
          </button>
          <button
            type="button"
            onClick={() => void saveReportDraft()}
            disabled={disabled || saving}
            className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-10 items-center justify-center gap-1.5 rounded-[10px] border border-[#d5dbe2] bg-white text-[#526171] transition hover:bg-[#f3f5f7] disabled:opacity-50`}
          >
            {savingAction === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            임시저장
          </button>
        </div>

        {error ? <p className={`${OWNER_TYPOGRAPHY.label} mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[#a04455]`}>{error}</p> : null}
      </div>
    </section>
  );
}
