"use client";

import { CheckCircle2, ImageIcon, Loader2, PencilLine, RefreshCcw, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import type { GroomingCompletionDetails } from "@/components/owner-web/calendar-grooming-completion-fields";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { careReportDraftSchema, type CareReportDraft, type CareReportObservations } from "@/types/care-report";

type DraftResponse = {
  draft: {
    careReportAiDraft?: unknown;
    careReportOwnerConfirmedAt?: string | null;
    careReportPhotoConsent?: boolean;
  } | null;
};

const editableFields: Array<[keyof Omit<CareReportDraft, "homeCareTips">, string]> = [
  ["oneLineSummary", "오늘의 한 줄"],
  ["treatmentSummary", "오늘 진행한 미용"],
  ["conditionSummary", "오늘 확인한 상태"],
  ["groomingResponse", "미용 중 반응"],
  ["nextVisitGuide", "다음 방문 안내"],
];

function linesContaining(lines: string[], keywords: string[]) {
  return lines
    .filter((line) => keywords.some((keyword) => line.includes(keyword)))
    .slice(0, 8)
    .map((line) => line.slice(0, 80));
}

function buildObservations(details: GroomingCompletionDetails): CareReportObservations {
  const publicLines = details.specialNotes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 24);
  const customNote = [
    details.specialNotes.trim() ? `오늘 확인한 내용: ${details.specialNotes.trim()}` : "",
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

function buildPreviewReport(details: GroomingCompletionDetails, serviceName: string): CareReportDraft {
  const publicNotes = details.specialNotes.split("\n").map((line) => line.trim()).filter(Boolean);
  const responseNote = publicNotes.find((line) => /반응|예민|긴장|편안/.test(line));
  const conditionNotes = publicNotes.filter((line) => line !== responseNote);
  return {
    oneLineSummary: "오늘도 편안하게 미용을 마쳤어요.",
    treatmentSummary: `${serviceName || "예약한 미용"} 내용대로 깔끔하게 마무리했어요.`,
    conditionSummary: conditionNotes.join(" ") || "오늘 특별히 불편해 보이는 부분 없이 미용을 마쳤어요.",
    groomingResponse: responseNote || "미용하는 동안 편안하게 잘 따라와 주었어요.",
    homeCareTips: conditionNotes.length > 0 ? ["오늘 안내드린 부분을 집에서도 가볍게 확인해 주세요."] : ["평소처럼 가볍게 빗질해 주세요."],
    nextVisitGuide: details.nextRecommendedVisitDate
      ? `${details.nextRecommendedVisitDate} 전후로 다음 관리를 권장해요.`
      : "아이의 털 길이와 상태에 맞춰 다음 방문 시점을 안내해 드릴게요.",
  };
}

export function CalendarCareReportCompletionPanel({
  shopId,
  appointmentId,
  details,
  serviceName = "",
  disabled,
  onPendingChange,
}: {
  shopId: string;
  appointmentId: string;
  details: GroomingCompletionDetails;
  serviceName?: string;
  disabled?: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [report, setReport] = useState<CareReportDraft | null>(null);
  const [photoConsent, setPhotoConsent] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [editing, setEditing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const observations = useMemo(() => buildObservations(details), [details]);
  const previewMode = typeof window !== "undefined" && (/^\/demo(?:\/|$)/.test(window.location.pathname) || /^\/dev(?:\/|$)/.test(window.location.pathname));
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
        setPhotoConsent(Boolean(response.draft.careReportPhotoConsent));
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

  async function generateReport() {
    if (disabled || generating) return;
    setGenerating(true);
    setError("");
    try {
      if (previewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 420));
        setReport(buildPreviewReport(details, serviceName));
        setConfirmed(false);
        setEditing(false);
        return;
      }
      const response = await fetchApiJsonWithAuth<{ careReport: CareReportDraft }>("/api/owner/care-reports", {
        method: "POST",
        body: JSON.stringify({ shopId, appointmentId, observations, voiceTranscript: "", photoConsent }),
      });
      setReport(careReportDraftSchema.parse(response.careReport));
      setConfirmed(false);
      setEditing(false);
    } catch (generationError) {
      setError(generationError instanceof Error ? generationError.message : "AI 케어리포트 초안을 만들지 못했습니다.");
    } finally {
      setGenerating(false);
    }
  }

  async function confirmReport() {
    if (!report || disabled || saving) return;
    setSaving(true);
    setError("");
    try {
      if (previewMode) {
        await new Promise((resolve) => window.setTimeout(resolve, 220));
        setConfirmed(true);
        setEditing(false);
        return;
      }
      await fetchApiJsonWithAuth("/api/owner/care-reports", {
        method: "PATCH",
        body: JSON.stringify({ shopId, appointmentId, careReport: report, photoConsent }),
      });
      setConfirmed(true);
      setEditing(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "케어리포트 확인 상태를 저장하지 못했습니다.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 overflow-hidden rounded-[14px] border border-[#cddff1] bg-gradient-to-br from-[#f8fbff] to-[#edf5ff] shadow-[0_10px_30px_rgba(47,111,214,0.10)]">
      <div className="flex items-start justify-between gap-3 border-b border-[#dbe7f3] bg-white/85 px-4 py-3.5">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[#e4effd] text-[#2f6fd6]">
            <Sparkles className="h-[18px] w-[18px]" />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-semibold text-[#172c46]">AI가 고객용 케어리포트를 써드려요</p>
              <span className="rounded-full border border-[#cddff1] bg-white px-2 py-0.5 text-[10px] font-semibold text-[#536f8e]">선택</span>
            </div>
            <p className="mt-0.5 text-[12px] leading-5 text-[#667b92]">지금 닫아도 완료 상태는 유지됩니다. 작성하면 고객 링크에 바로 반영됩니다.</p>
          </div>
        </div>
        {confirmed ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#a9d8c8] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#27715a]">
            <CheckCircle2 className="h-3.5 w-3.5" /> 확인 완료
          </span>
        ) : null}
      </div>

      <div className="p-4">
        {!report ? (
          <>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-medium text-[#617b98]">
            <span className="rounded-[9px] border border-[#d9e5f1] bg-white px-2 py-2.5">예약 서비스</span>
            <span className="rounded-[9px] border border-[#d9e5f1] bg-white px-2 py-2.5">오늘 상태</span>
            <span className="rounded-[9px] border border-[#d9e5f1] bg-white px-2 py-2.5">완료 사진</span>
            </div>
          <label className="mt-3 flex items-center gap-2 rounded-[9px] border border-[#d9e5f1] bg-white px-3 py-2.5 text-[12px] text-[#536b85]">
              <input
                type="checkbox"
                checked={photoConsent}
                onChange={(event) => setPhotoConsent(event.target.checked)}
                disabled={disabled || generating}
                className="h-4 w-4 accent-[#df6b79]"
              />
            <ImageIcon className="h-3.5 w-3.5 text-[#3978b5]" /> 고객에게 미용 전·후 사진도 함께 보여주기
            </label>
            <button
              type="button"
              onClick={() => void generateReport()}
              disabled={disabled || generating}
            className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[#2f6fd6] text-[14px] font-semibold text-white shadow-[0_8px_20px_rgba(47,111,214,0.22)] transition hover:bg-[#255fc1] disabled:opacity-50"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "AI가 정리하는 중" : "AI 케어리포트 초안 만들기"}
            </button>
          </>
        ) : editing ? (
          <div className="space-y-3">
            {editableFields.map(([key, label]) => (
              <label key={key} className="block">
              <span className="text-[12px] font-semibold text-[#536b85]">{label}</span>
                <textarea
                  value={report[key]}
                  onChange={(event) => editReport({ ...report, [key]: event.target.value })}
                  disabled={disabled || saving}
                className="mt-1 min-h-[58px] w-full resize-y rounded-[9px] border border-[#d7e3ef] bg-white px-3 py-2.5 text-[13px] leading-5 text-[#263b53] outline-none focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60"
                />
              </label>
            ))}
            <label className="block">
            <span className="text-[12px] font-semibold text-[#536b85]">홈케어 팁</span>
              <textarea
                value={report.homeCareTips.join("\n")}
                onChange={(event) => editReport({ ...report, homeCareTips: event.target.value.split("\n").map((line) => line.trim()).filter(Boolean).slice(0, 4) })}
                disabled={disabled || saving}
              className="mt-1 min-h-[68px] w-full resize-y rounded-[9px] border border-[#d7e3ef] bg-white px-3 py-2.5 text-[13px] leading-5 text-[#263b53] outline-none focus:border-[#7eaae0] focus:ring-2 focus:ring-[#deebfa] disabled:opacity-60"
              />
            </label>
          </div>
        ) : (
          <div className="rounded-[12px] border border-[#d7e4f1] bg-white p-4 shadow-[0_8px_24px_rgba(43,81,124,0.08)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold text-[#2f6fd6]">AI 초안</p>
                <p className="mt-1 text-[16px] font-semibold leading-6 text-[#172c46]">{report.oneLineSummary}</p>
              </div>
              <button type="button" onClick={() => setEditing(true)} className="inline-flex shrink-0 items-center gap-1 rounded-full border border-[#d6e2ef] px-2.5 py-1.5 text-[11px] font-semibold text-[#536f8e] hover:bg-[#f4f8fd]">
                <PencilLine className="h-3 w-3" /> 문장 수정
              </button>
            </div>
            <div className="mt-3 space-y-2.5 border-t border-[#e2ebf4] pt-3 text-[12px] leading-5 text-[#53687f]">
              <p><strong className="mr-2 text-[#263b53]">오늘 미용</strong>{report.treatmentSummary}</p>
              <p><strong className="mr-2 text-[#263b53]">오늘 상태</strong>{report.conditionSummary}</p>
              <p><strong className="mr-2 text-[#263b53]">아이 반응</strong>{report.groomingResponse}</p>
              <p><strong className="mr-2 text-[#263b53]">홈케어</strong>{report.homeCareTips.join(" · ")}</p>
              <p><strong className="mr-2 text-[#263b53]">다음 방문</strong>{report.nextVisitGuide}</p>
            </div>
          </div>
        )}

        {report ? (
          <div className="mt-3 grid grid-cols-[0.8fr_1.2fr] gap-2">
            <button type="button" onClick={() => void generateReport()} disabled={disabled || generating || saving} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] border border-[#d5e2ef] bg-white text-[13px] font-semibold text-[#536f8e] hover:bg-[#f4f8fd] disabled:opacity-50">
              <RefreshCcw className="h-3.5 w-3.5" /> 다시 만들기
            </button>
            <button type="button" onClick={() => void confirmReport()} disabled={disabled || saving} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[9px] bg-[#2f6fd6] text-[13px] font-semibold text-white shadow-[0_6px_16px_rgba(47,111,214,0.18)] disabled:opacity-50">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {confirmed ? "수정 내용 확인" : "이 내용으로 저장"}
            </button>
          </div>
        ) : null}

        {error ? <p className="mt-3 rounded-[9px] border border-[#f1b9c1] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#a04455]">{error}</p> : null}
        <p className="mt-2 text-[11px] leading-4 text-[#72869d]">자동 발송되지 않습니다. 오너가 확인한 내용만 저장됩니다.</p>
      </div>
    </section>
  );
}
