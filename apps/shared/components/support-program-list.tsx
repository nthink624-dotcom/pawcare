import { IconArrowUpRight, IconCalendarDue, IconFlag } from "@tabler/icons-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { supportProgramsSource, type SupportProgram } from "../contracts/support-programs";

const publishedDate = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric" });
const dayMs = 86_400_000;

function deadlineBadge(closesOn: string | null, referenceDate?: string) {
  if (!closesOn || !referenceDate) return null;
  const diff = Math.round((Date.parse(`${closesOn.slice(0, 10)}T00:00:00Z`) - Date.parse(`${referenceDate.slice(0, 10)}T00:00:00Z`)) / dayMs);
  if (!Number.isFinite(diff)) return null;
  if (diff < 0) return { label: "마감", className: "bg-[#f1f4f8] text-[#5b6b82]" };
  if (diff === 0) return { label: "오늘 마감", className: "bg-[#fff0f0] text-[#c62f37]" };
  return { label: `D-${diff}`, className: diff <= 3 ? "bg-[#fff0f0] text-[#c62f37]" : "bg-[#f1f4f8] text-[#5b6b82]" };
}

function shortPeriod(period: string) {
  const match = period.match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*~\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (!match || match[1] !== match[4]) return period;
  return `${match[2]}.${match[3]} ~ ${match[5]}.${match[6]}`;
}

function DayPanelSupportProgramList({ programs, title, controls, footer, referenceDate }: {
  programs: SupportProgram[];
  title: string;
  controls?: ReactNode;
  footer?: ReactNode;
  referenceDate?: string;
}) {
  return <section aria-label={title} className="min-w-0">
    <div className="mb-2 flex min-w-0 items-center justify-between gap-3 pr-0.5">
      <h3 className="flex min-w-0 items-center gap-1 text-[15px] font-semibold leading-[22px] text-[#1e293b]">
        <IconFlag size={18} stroke={1.8} className="mr-0.5 shrink-0 text-[#475569]" aria-hidden="true" />
        <span className="truncate">{title}</span>
        <span className="font-medium tabular-nums text-[#64748b]">{programs.length}</span>
      </h3>
      <a href={supportProgramsSource} target="_blank" rel="noopener noreferrer" data-owner-control-size="content" className="-my-3 inline-flex min-h-11 shrink-0 items-center gap-0.5 rounded px-1 text-[12px] text-[#6b7a90] hover:text-[#334155] focus-visible:outline-2 focus-visible:outline-[#1677ff]">
        출처 기업마당<IconArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> · 새 창</span>
      </a>
    </div>
    {controls}
    {programs.length > 0 && <ul className="divide-y divide-[#edf1f5] overflow-hidden rounded-[10px] border border-[#e8edf3] bg-white">
      {programs.map(program => {
        const badge = deadlineBadge(program.closesOn, referenceDate);
        const meta = [program.agency, program.applicationPeriod ? shortPeriod(program.applicationPeriod) : ""].filter(Boolean);
        // The whole row opens the official notice, so it carries no separate arrow.
        return <li key={program.id}>
          <a href={program.sourceUrl} target="_blank" rel="noopener noreferrer" data-owner-control-size="content" data-support-program={program.id} className="block min-h-11 w-full min-w-0 px-3 py-2 transition-colors hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#1677ff]">
            {badge || meta.length ? <span className="mb-0.5 flex min-w-0 items-center gap-1.5">
              {badge ? <span className={cn("inline-flex h-[18px] shrink-0 items-center rounded-[5px] px-1.5 text-[11px] font-medium tabular-nums", badge.className)}>{badge.label}</span> : null}
              {meta.length ? <span className="min-w-0 truncate text-[12px] leading-4 text-[#6b7a90]">{meta.join(" · ")}</span> : null}
            </span> : null}
            <span title={program.title} className="line-clamp-2 break-keep text-[14px] font-medium leading-5 text-[#0f1b2d] [overflow-wrap:anywhere]">{program.title}</span>
            <span className="sr-only">공고 원문 · 새 창</span>
          </a>
        </li>;
      })}
    </ul>}
    {footer}
  </section>;
}

export function SupportProgramList({ programs, title, showPublishedDate = false, controls, footer, variant, referenceDate }: {
  programs: SupportProgram[];
  title: string;
  showPublishedDate?: boolean;
  controls?: ReactNode;
  footer?: ReactNode;
  variant?: "day-panel";
  /** day-panel only: date (YYYY-MM-DD) used to count down to each program's closing date. */
  referenceDate?: string;
}) {
  if (!programs.length && !controls) return null;
  if (variant === "day-panel") return <DayPanelSupportProgramList programs={programs} title={title} controls={controls} footer={footer} referenceDate={referenceDate} />;
  return <section aria-label={title} className="min-w-0 space-y-2 border-t border-[#e8edf3] py-3">
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1">
      <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#25324a]">
        <IconCalendarDue size={17} stroke={1.7} className="shrink-0 text-[#42658f]" aria-hidden="true" />{title}
      </h3>
      <a href={supportProgramsSource} target="_blank" rel="noopener noreferrer" data-owner-control-size="content" className="inline-flex min-h-11 items-center gap-1 rounded px-1 text-[12px] font-medium text-[#42658f] hover:underline focus-visible:outline-2 focus-visible:outline-blue-600">
        출처 기업마당<IconArrowUpRight size={13} aria-hidden="true" /><span className="sr-only"> · 새 창</span>
      </a>
    </div>
    {controls}
    {programs.length > 0 && <ul className="divide-y divide-[#e8edf3] rounded-[10px] border border-[#e8edf3]">
      {programs.map(program => <li key={program.id}>
        <a href={program.sourceUrl} target="_blank" rel="noopener noreferrer" data-owner-control-size="content" className="flex min-h-11 min-w-0 items-start gap-2 rounded-[9px] px-3 py-2.5 hover:bg-[#f5f8fc] focus-visible:outline-2 focus-visible:outline-blue-600" data-support-program={program.id}>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="break-keep text-[14px] font-medium leading-5 text-[#25324a] [overflow-wrap:anywhere]">{program.title}</p>
            {(program.agency || (showPublishedDate && program.publishedAt)) ? (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] leading-[18px] text-[#526175]">
                {program.agency ? <span className="min-w-0 [overflow-wrap:anywhere]">{program.agency}</span> : null}
                {showPublishedDate && program.publishedAt ? <time dateTime={program.publishedAt}>등록 {publishedDate.format(new Date(program.publishedAt))}</time> : null}
              </div>
            ) : null}
            {program.applicationPeriod ? <p className="break-words text-[12px] leading-[18px] text-[#526175]">신청기간 {program.applicationPeriod}</p> : null}
          </div>
          <IconArrowUpRight size={15} className="mt-0.5 shrink-0 text-[#526175]" aria-hidden="true" /><span className="sr-only">공고 원문 · 새 창</span>
        </a>
      </li>)}
    </ul>}
    {footer}
  </section>;
}
