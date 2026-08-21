"use client";

import { CheckCircle2, FileCheck2, Loader2, PencilLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

import { CalendarCareNoteInput } from "@/components/owner-web/calendar-care-note-input";
import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";
import { fetchApiJsonWithAuth } from "@/lib/api";
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
  currentWeightKg: 4.6,
  previousWeightKg: 4.5,
  recentAverageWeightKg: 4.5,
};

function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return [hours ? `${hours}시간` : "", remainder ? `${remainder}분` : ""].filter(Boolean).join(" ");
}

function buildPreviewReport(details: GroomingCompletionDetails, serviceName: string, ownerSourceText: string): CareReportDraft {
  const publicNotes = ownerSourceText.split("\n").map((line) => line.trim()).filter(Boolean);
  const responseNote = publicNotes.find((line) => /반응|예민|긴장|편안/.test(line));
  const conditionNotes = publicNotes.filter((line) => line !== responseNote);
  const normalizedOwnerSourceText = publicNotes.join(" ");
  const service = serviceName || "예약한 미용";
  const automaticSummary = `${previewAutomaticFacts.petName}가 오늘 ${service}을 ${formatDuration(previewAutomaticFacts.actualDurationMinutes)} 동안 마쳤어요. 현재 몸무게는 ${previewAutomaticFacts.currentWeightKg.toFixed(1)}kg으로, 같은 아이의 최근 기록 평균 ${previewAutomaticFacts.recentAverageWeightKg.toFixed(1)}kg과 비슷해요.`;
  const designerMessage = [normalizedOwnerSourceText, automaticSummary].filter(Boolean).join(" ").slice(0, 160);
  return {
    oneLineSummary: designerMessage,
    treatmentSummary: `${service}을 진행했고, 총 작업 시간은 ${formatDuration(previewAutomaticFacts.actualDurationMinutes)}이었어요.`,
    conditionSummary: conditionNotes.join(" ") || "오너가 별도로 남긴 상태 기록은 없어요.",
    groomingResponse: responseNote || "오너가 별도로 남긴 미용 반응 기록은 없어요.",
    homeCareTips: conditionNotes.length > 0 ? [conditionNotes.join(" ")] : ["오너가 별도로 남긴 홈케어 안내는 없어요."],
    nextVisitGuide: details.nextRecommendedVisitDate
      ? `${details.nextRecommendedVisitDate} 전후로 다음 관리를 권장해요.`
      : "다음 권장 방문일은 별도로 지정되지 않았어요.",
  };
}

function AiGeneratingMessage() {
  return (
    <div className="flex justify-start">
      <div className="inline-flex items-center gap-2 rounded-[16px] rounded-bl-[6px] border border-[#d6e4f2] bg-white px-4 py-3 text-[#536f8e]">
        <Loader2 className="h-4 w-4 animate-spin text-[#2f6fd6]" />
        <span className={OWNER_TYPOGRAPHY.body}>AI가 케어리포트를 정리하고 있어요</span>
      </div>
    </div>
  );
}

function AiPolishedMessage({
  content,
  expanded,
  disabled,
  onChange,
  onToggle,
}: {
  content: string;
  expanded: boolean;
  disabled?: boolean;
  onChange: (content: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="w-full rounded-[14px] border border-[#c9dced] bg-white px-4 py-3.5 shadow-[0_8px_24px_rgba(43,81,124,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <p className={`${OWNER_TYPOGRAPHY.meta} flex items-center gap-1.5 text-[#2f6fd6]`}>
          <Sparkles className="h-3.5 w-3.5" /> AI가 정리한 문장
        </p>
        <span className={`${OWNER_TYPOGRAPHY.badge} rounded-full bg-[#edf5ff] px-2.5 py-1 text-[#536f8e]`}>직접 수정 가능</span>
      </div>
      <textarea
        value={content}
        onChange={(event) => onChange(event.target.value.slice(0, 160))}
        disabled={disabled}
        maxLength={160}
        aria-label="AI가 정리한 문장 편집"
        className={`${OWNER_TYPOGRAPHY.body} mt-2 min-h-[104px] w-full resize-y rounded-[10px] border border-[#dce7f1] bg-[#f9fbfe] px-3.5 py-3 leading-7 text-[#172c46] outline-none focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60`}
      />
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onToggle}
          className={`${OWNER_TYPOGRAPHY.label} mt-2 text-[#5b7693] underline decoration-[#b9ccdf] underline-offset-4 hover:text-[#2f6fd6]`}
        >
          {expanded ? "전체 내용 닫기" : "전체 케어리포트 보기"}
        </button>
        <span className={`${OWNER_TYPOGRAPHY.helper} text-[#8a9caf]`}>{content.length}/160</span>
      </div>
    </div>
  );
}

function ReportEditor({
  report,
  onChange,
  disabled,
}: {
  report: CareReportDraft;
  onChange: (report: CareReportDraft) => void;
  disabled?: boolean;
}) {
  const fieldClassName = `${OWNER_TYPOGRAPHY.body} mt-2 w-full resize-y rounded-[9px] border border-[#d7e3ef] bg-white px-3.5 py-3 text-[#263b53] outline-none focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60`;

  return (
    <div className="space-y-3 rounded-[13px] border border-[#d5e3f1] bg-[#f8fbff] p-4">
      <label className="block">
        <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>디자이너의 한마디</span>
        <textarea
          value={report.oneLineSummary}
          onChange={(event) => onChange({ ...report, oneLineSummary: event.target.value })}
          disabled={disabled}
          className={`${fieldClassName} min-h-[96px]`}
        />
      </label>
      <div className="grid gap-3 xl:grid-cols-2">
        <label className="block">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>오늘 진행한 미용</span>
          <textarea
            value={report.treatmentSummary}
            onChange={(event) => onChange({ ...report, treatmentSummary: event.target.value })}
            disabled={disabled}
            className={`${fieldClassName} min-h-[82px]`}
          />
        </label>
        <label className="block">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>오늘 확인한 상태</span>
          <textarea
            value={report.conditionSummary}
            onChange={(event) => onChange({ ...report, conditionSummary: event.target.value })}
            disabled={disabled}
            className={`${fieldClassName} min-h-[82px]`}
          />
        </label>
        <label className="block">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>미용 중 반응</span>
          <textarea
            value={report.groomingResponse}
            onChange={(event) => onChange({ ...report, groomingResponse: event.target.value })}
            disabled={disabled}
            className={`${fieldClassName} min-h-[82px]`}
          />
        </label>
        <label className="block">
          <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>홈케어 안내</span>
          <textarea
            value={report.homeCareTips.join("\n")}
            onChange={(event) => {
              const homeCareTips = event.target.value.split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 4);
              if (homeCareTips.length > 0) onChange({ ...report, homeCareTips });
            }}
            disabled={disabled}
            className={`${fieldClassName} min-h-[82px]`}
          />
        </label>
      </div>
      <label className="block">
        <span className={`${OWNER_TYPOGRAPHY.label} text-[#536b85]`}>다음 방문 안내</span>
        <input
          value={report.nextVisitGuide}
          onChange={(event) => onChange({ ...report, nextVisitGuide: event.target.value })}
          disabled={disabled}
          className={`${OWNER_TYPOGRAPHY.body} mt-2 h-12 w-full rounded-[9px] border border-[#d7e3ef] bg-white px-3.5 text-[#263b53] outline-none focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60`}
        />
      </label>
    </div>
  );
}

export function CalendarCareReportCompletionPanel({
  shopId,
  appointmentId,
  details,
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
  onDetailsChange: (details: GroomingCompletionDetails) => void;
  hasRegisteredPhotos: boolean;
  serviceName?: string;
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
  onSaveDraft?: () => Promise<void> | void;
  onReportSent?: () => Promise<void> | void;
}) {
  const [report, setReport] = useState<CareReportDraft | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [savingAction, setSavingAction] = useState<"draft" | "publish" | null>(null);
  const [error, setError] = useState("");
  const [composerValue, setComposerValue] = useState("");
  const [showReportDetails, setShowReportDetails] = useState(false);
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
        setShowReportDetails(false);
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
        setReport(buildPreviewReport(details, serviceName, transientInput));
        setShowReportDetails(false);
        setConfirmed(false);
        setEditing(false);
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
        }),
      });
      setReport(careReportDraftSchema.parse(response.careReport));
      setShowReportDetails(false);
      setConfirmed(false);
      setEditing(false);
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
        setEditing(false);
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
      setEditing(false);
      await onReportSent?.();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "케어리포트를 보내지 못했습니다.");
    } finally {
      setSavingAction(null);
    }
  }

  return (
    <section className="overflow-hidden rounded-[16px] border border-[#bfd4e9] bg-[#f1f7fe] shadow-[0_16px_44px_rgba(42,87,137,0.12)]">
      <div className="flex items-start justify-between gap-4 border-b border-[#d7e5f2] bg-[#eaf3fe] px-5 py-[18px]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[12px] bg-[#2f6fd6] text-white shadow-[0_7px_18px_rgba(47,111,214,0.22)]">
            <Sparkles className="h-[19px] w-[19px]" />
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`${OWNER_TYPOGRAPHY.sectionTitle} tracking-[-0.02em] text-[#172c46]`}>AI 케어리포트</h3>
            <span className={`${OWNER_TYPOGRAPHY.badge} rounded-full border border-[#c5d9ee] bg-white/80 px-2.5 py-1 text-[#536f8e]`}>선택 기능</span>
          </div>
        </div>
        {confirmed ? (
          <span className={`${OWNER_TYPOGRAPHY.badge} inline-flex shrink-0 items-center gap-1 rounded-full border border-[#a9d8c8] bg-white px-3 py-1.5 text-[#27715a]`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> 검토 완료
          </span>
        ) : (
          <span className={`${OWNER_TYPOGRAPHY.meta} inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d2dfed] bg-white/80 px-3 py-1.5 text-[#677d94]`}>
            <FileCheck2 className="h-3.5 w-3.5" /> 검토 전
          </span>
        )}
      </div>

      <div className="p-5">
        <div className="max-h-[520px] space-y-3 overflow-y-auto pr-1">
          {generating ? <AiGeneratingMessage /> : null}

          {report && !editing ? (
            <AiPolishedMessage
              content={report.oneLineSummary}
              expanded={showReportDetails}
              disabled={disabled || saving}
              onChange={(content) => editReport({ ...report, oneLineSummary: content })}
              onToggle={() => setShowReportDetails((current) => !current)}
            />
          ) : null}

          {editing && report ? (
            <ReportEditor report={report} onChange={editReport} disabled={disabled || saving} />
          ) : report && showReportDetails ? (
            <div className="overflow-hidden rounded-[14px] rounded-bl-[6px] border border-[#d3e1ee] bg-white shadow-[0_8px_24px_rgba(43,81,124,0.07)]">
              <div className="flex items-center justify-between gap-3 border-b border-[#e3ebf3] bg-[#f8fbff] px-4 py-3">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-[#2f6fd6]" />
                  <p className={`${OWNER_TYPOGRAPHY.label} text-[#536f8e]`}>고객에게 보낼 전체 내용</p>
                </div>
                <button type="button" onClick={() => setEditing(true)} className={`${OWNER_TYPOGRAPHY.badge} inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d6e2ef] bg-white px-3 py-1.5 text-[#536f8e] hover:bg-[#f4f8fd]`}>
                  <PencilLine className="h-3 w-3" /> 수정하기
                </button>
              </div>
              <div className="grid gap-px bg-[#e4ecf4] sm:grid-cols-2">
                {[
                  ["오늘 진행한 미용", report.treatmentSummary],
                  ["오늘 확인한 상태", report.conditionSummary],
                  ["미용 중 반응", report.groomingResponse],
                  ["홈케어 안내", report.homeCareTips.join(" ")],
                ].map(([label, content]) => (
                  <div key={label} className="bg-white px-4 py-3.5">
                    <p className={`${OWNER_TYPOGRAPHY.label} text-[#71859a]`}>{label}</p>
                    <p className={`${OWNER_TYPOGRAPHY.body} mt-1.5 text-[#304861]`}>{content}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-start gap-3 border-t border-[#e3ebf3] bg-[#f8fbff] px-4 py-3.5">
                <span className={`${OWNER_TYPOGRAPHY.label} shrink-0 text-[#5c7692]`}>다음 방문</span>
                <p className={`${OWNER_TYPOGRAPHY.body} text-[#405a75]`}>{report.nextVisitGuide}</p>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 border-t border-[#d7e5f2] pt-4">
          <CalendarCareNoteInput
            value={composerValue}
            onChange={setComposerValue}
            onSubmit={submitOwnerMessage}
            submitting={generating}
            disabled={disabled}
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => void saveReportDraft()}
            disabled={disabled || saving}
            className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-12 items-center justify-center gap-1.5 rounded-[10px] border border-[#cfddea] bg-white text-[#536f8e] hover:bg-[#f7faff] disabled:opacity-50`}
          >
            {savingAction === "draft" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            임시저장
          </button>
          <button
            type="button"
            onClick={() => void publishReport()}
            disabled={!report || disabled || saving}
            className={`${OWNER_TYPOGRAPHY.bodyStrong} inline-flex h-12 items-center justify-center gap-1.5 rounded-[10px] bg-[#2f6fd6] text-white shadow-[0_7px_18px_rgba(47,111,214,0.18)] disabled:cursor-not-allowed disabled:opacity-40`}
          >
            {savingAction === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            리포트 보내기
          </button>
        </div>

        {error ? <p className={`${OWNER_TYPOGRAPHY.label} mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3.5 py-3 text-[#a04455]`}>{error}</p> : null}
      </div>
    </section>
  );
}
