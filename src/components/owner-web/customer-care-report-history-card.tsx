"use client";

import { CheckCircle2, Send } from "lucide-react";

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
  return (
    <section className="rounded-[10px] border border-[#cfe0f2] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="whitespace-pre-wrap break-words text-[16px] font-normal leading-7 text-[#334155]">{report.reportText}</p>
        <span className="inline-flex items-center gap-1 rounded-full border border-[#bfd7f2] bg-white px-2.5 py-1 text-[12px] font-semibold text-[#315f8e]">
          {sentAt ? <Send className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
          {sentAt ? "고객 발송 완료" : confirmedAt ? "오너 확인 완료" : "AI 초안"}
        </span>
      </div>
    </section>
  );
}
