"use client";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { getOwnerPlanDisplayName, OWNER_SINGLE_MONTHLY_PLAN_CODE } from "@/lib/billing/owner-plans";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { LEGAL_BUSINESS_INFO } from "@/lib/legal/legal-info";

function formatServiceEndDate(summary: OwnerSubscriptionSummary) {
  const value = summary.currentPeriodEndsAt ?? summary.trialEndsAt;
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10).replace(/-/g, ".");
  }

  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function getResumePlanCode(summary: OwnerSubscriptionSummary) {
  return summary.currentPlanCode === "free" ? OWNER_SINGLE_MONTHLY_PLAN_CODE : summary.currentPlanCode;
}

export default function OwnerServiceExpiredScreen({
  summary,
  onLogout,
  loggingOut = false,
}: {
  summary: OwnerSubscriptionSummary;
  onLogout?: () => void;
  loggingOut?: boolean;
}) {
  const isPastDue = summary.status === "past_due";
  const resumePlanCode = getResumePlanCode(summary);
  const supportHref = `mailto:${LEGAL_BUSINESS_INFO.customerServiceEmail}?subject=${encodeURIComponent(
    `${PETMANAGER_SERVICE_NAME} 서비스 기간 연장 문의`,
  )}`;

  return (
    <main className="owner-font pm-owner-web flex min-h-screen flex-col bg-[#f6f7f9] text-[var(--ink)]">
      <header className="border-b border-[#dbe2ea] bg-white">
        <div className="mx-auto flex min-h-[68px] w-full max-w-[1240px] flex-wrap items-center gap-3 px-5 py-3 sm:px-8">
          <PetManagerBrand
            priority
            imageClassName="h-[21px] w-auto"
            className="max-w-full"
            nameClassName="whitespace-normal text-[17px] text-[#173b33] [overflow-wrap:anywhere]"
          />
          {onLogout ? (
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="ml-auto inline-flex min-h-11 min-w-0 max-w-full items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-3.5 text-center text-[13px] font-medium whitespace-normal text-[#475569] transition [overflow-wrap:anywhere] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94a3b8] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loggingOut ? "로그아웃 중..." : "다른 계정으로 로그인"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="flex flex-1 items-center px-5 py-10 sm:px-8 sm:py-14">
        <section className="mx-auto w-full max-w-[560px] rounded-[14px] border border-[#dbe2ea] bg-white px-5 py-7 sm:px-8 sm:py-9">
          <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.03em] text-[#1f2937] [overflow-wrap:anywhere] sm:text-[28px] sm:leading-9">
            {isPastDue ? "결제를 완료해 주세요" : "이용 기간이 종료되었습니다"}
          </h1>
          <p className="mt-3 text-[16px] font-normal leading-6 text-[#64748b] [overflow-wrap:anywhere]">
            기간을 연장하면 바로 다시 이용할 수 있습니다.
          </p>

          <dl className="mt-7 divide-y divide-[#e7edf3] border-y border-[#e7edf3]">
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-[14px] font-medium leading-5 text-[#64748b]">서비스 종료일</dt>
              <dd className="text-[14px] font-medium leading-5 text-[#273142] [overflow-wrap:anywhere] sm:text-right">
                {formatServiceEndDate(summary)}
              </dd>
            </div>
            <div className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
              <dt className="text-[14px] font-medium leading-5 text-[#64748b]">마지막 이용 플랜</dt>
              <dd className="text-[14px] font-medium leading-5 text-[#273142] [overflow-wrap:anywhere] sm:text-right">
                {summary.currentPlanCode === "free"
                  ? "무료 체험 플랜"
                  : getOwnerPlanDisplayName(summary.currentPlanCode)}
              </dd>
            </div>
          </dl>

          <a
            href={`/owner/billing?compare=1&notice=${isPastDue ? "past_due" : "expired"}&plan=${resumePlanCode}`}
            className="mt-7 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] bg-[#111a30] px-5 py-3 text-[14px] font-medium text-white transition hover:bg-[#0b1222] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#111a30] focus-visible:ring-offset-2"
          >
            기간 연장하기
          </a>

          <a
            href={supportHref}
            aria-label="결제·이용 문의 이메일 보내기"
            className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-[8px] px-4 py-2 text-[14px] font-medium text-[#475569] underline-offset-4 transition hover:bg-[#f8fafc] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#94a3b8] focus-visible:ring-offset-2"
          >
            결제·이용 문의
          </a>
        </section>
      </div>
    </main>
  );
}
