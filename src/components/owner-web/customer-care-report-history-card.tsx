"use client";

import { CheckCircle2, Send, Sparkles } from "lucide-react";

import type { CareReportDraft } from "@/types/care-report";

export function CustomerCareReportHistoryCard({
  report,
  confirmedAt,
  sentAt,
}: {
  report: CareReportDraft;
  confirmedAt: string | null | undefined;
  sentAt: string | null | undefined;
}) {
  const detailBlocks = [
    ["오늘 진행한 미용", report.treatmentSummary],
    ["오늘 확인한 상태", report.conditionSummary],
    ["미용 중 반응", report.groomingResponse],
    ["다음 방문 안내", report.nextVisitGuide],
  ].filter((item): item is [string, string] => Boolean(item[1]?.trim()));

  return (
    <section className="rounded-[10px] border border-[#cfe0f2] bg-[#f5f9fe] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-[14px] font-semibold text-[#3978b5]">
            <Sparkles className="h-4 w-4" /> AI 케어리포트
          </p>
          <p className="mt-1 text-[18px] font-semibold leading-7 text-[#173f6b]">{report.oneLineSummary}</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bfd7f2] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#315f8e]">
          {sentAt ? <Send className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {sentAt ? "고객 발송 완료" : confirmedAt ? "오너 확인 완료" : "AI 초안"}
        </span>
      </div>
      {detailBlocks.length ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {detailBlocks.map(([title, value]) => <CareReportBlock key={title} title={title} value={value} />)}
        </div>
      ) : null}
      {report.homeCareTips.length ? (
        <div className="mt-3 rounded-[8px] border border-[#d7e5f3] bg-white px-3.5 py-3">
          <p className="text-[13px] font-semibold text-[#4c6682]">홈케어 팁</p>
          <ul className="mt-2 space-y-1.5 text-[14px] leading-6 text-[#334155]">
            {report.homeCareTips.map((tip) => <li key={tip}>· {tip}</li>)}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function CareReportBlock({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#d7e5f3] bg-white px-3.5 py-3">
      <p className="text-[13px] font-semibold text-[#4c6682]">{title}</p>
      <p className="mt-1.5 whitespace-pre-wrap text-[14px] leading-6 text-[#334155]">{value}</p>
    </div>
  );
}
