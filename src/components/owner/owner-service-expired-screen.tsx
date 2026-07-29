"use client";

import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  Database,
  Headphones,
  ShieldCheck,
} from "lucide-react";

import PetManagerBrand from "@/components/brand/petmanager-brand";
import { PETMANAGER_SERVICE_NAME } from "@/lib/brand";
import { getOwnerPlanDisplayName } from "@/lib/billing/owner-plans";
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
  return summary.currentPlanCode === "free" ? "monthly" : summary.currentPlanCode;
}

const preservedItems = [
  {
    icon: Database,
    title: "고객·예약 데이터",
    description: "기존 고객, 반려동물, 예약 기록은 그대로 보관됩니다.",
  },
  {
    icon: ShieldCheck,
    title: "매장 운영 설정",
    description: "서비스 메뉴와 직원 설정도 변경 없이 유지됩니다.",
  },
  {
    icon: CheckCircle2,
    title: "결제 후 즉시 재개",
    description: "결제가 완료되면 별도 설정 없이 바로 이용할 수 있습니다.",
  },
];

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
    <main className="owner-font pm-owner-web min-h-screen bg-[var(--bg)] text-[var(--ink)]">
      <header className="h-[68px] border-b border-[var(--line)] bg-white">
        <div className="mx-auto flex h-full w-full max-w-[1240px] items-center px-8">
          <PetManagerBrand
            priority
            markSize={34}
            imageClassName="h-[34px] w-[34px]"
            nameClassName="text-[17px] text-[#173b33]"
          />
          <div className="ml-auto flex items-center gap-4">
            <span className="text-[13px] font-medium text-[var(--mut)]">서비스 이용 제한</span>
            {onLogout ? (
              <button
                type="button"
                onClick={onLogout}
                disabled={loggingOut}
                className="inline-flex h-9 items-center rounded-[8px] border border-[var(--bd)] bg-white px-3.5 text-[13px] font-medium text-[var(--ink2)] transition hover:bg-[#f8fafc] disabled:opacity-60"
              >
                {loggingOut ? "로그아웃 중..." : "다른 계정으로 로그인"}
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="min-h-[calc(100vh-68px)] bg-[image:var(--pm-brand-blue-page-gradient)] px-8 py-10">
        <section className="mx-auto grid min-h-[620px] w-full max-w-[1180px] overflow-hidden rounded-[18px] border border-white/80 bg-white/95 shadow-[0_22px_58px_rgba(37,99,235,0.12)] backdrop-blur-sm lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="flex min-w-0 flex-col p-10 xl:p-12">
            <div>
              <span className="inline-flex h-8 items-center gap-2 rounded-full border border-[#bfdbfe] bg-[#eff6ff] px-3 text-[12px] font-semibold text-[#2563eb]">
                <CalendarDays className="h-4 w-4" strokeWidth={2} />
                서비스 이용 안내
              </span>

              <h1 className="mt-6 text-[38px] font-bold leading-[1.28] tracking-[-0.05em] text-[#181b21] xl:text-[42px]">
                {isPastDue ? (
                  <>
                    결제를 완료하고
                    <br />
                    서비스를 다시 시작하세요
                  </>
                ) : (
                  <>
                    서비스 이용 기간이
                    <br />
                    종료되었습니다
                  </>
                )}
              </h1>

              <p className="mt-5 max-w-[650px] text-[16px] leading-7 tracking-[-0.02em] text-[#646a74]">
                {isPastDue
                  ? "결제가 완료되지 않아 예약과 고객 관리 기능이 일시적으로 제한되었습니다. 결제를 완료하면 기존 운영 화면을 바로 이어서 사용할 수 있습니다."
                  : "현재 예약과 고객 관리 기능이 일시적으로 제한되었습니다. 이용 플랜을 선택하고 결제하면 기존 데이터와 설정을 그대로 이어서 사용할 수 있습니다."}
              </p>
            </div>

            <div className="mt-10 border-t border-[#e7edf3] pt-8">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5 text-[#2563eb]" strokeWidth={2} />
                <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[#273142]">
                  서비스가 중단되어도 운영 데이터는 안전하게 보관됩니다
                </h2>
              </div>

              <div className="mt-5 grid gap-3 xl:grid-cols-3">
                {preservedItems.map(({ icon: Icon, title, description }) => (
                  <article
                    key={title}
                    className="rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc] px-4 py-4"
                  >
                    <span className="flex h-9 w-9 items-center justify-center rounded-[9px] bg-[#eff6ff] text-[#2563eb]">
                      <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
                    </span>
                    <h3 className="mt-3 text-[14px] font-semibold text-[#273142]">{title}</h3>
                    <p className="mt-1.5 text-[13px] leading-5 text-[#7b8491]">{description}</p>
                  </article>
                ))}
              </div>
            </div>

            <p className="mt-auto pt-8 text-[12px] leading-5 text-[#969ba4]">
              결제 또는 서비스 이용 기간과 관련해 도움이 필요하시면 고객센터로 문의해 주세요.
            </p>
          </div>

          <aside className="flex flex-col border-l border-[#dbe2ea] bg-[#f8fafc] p-8">
            <div>
              <p className="text-[13px] font-semibold text-[#646a74]">이용 상태</p>
              <div className="mt-4 overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-white">
                <div className="flex items-start justify-between gap-5 border-b border-[#e7edf3] px-4 py-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#7b8491]">
                    <CalendarDays className="h-4 w-4 text-[#64748b]" strokeWidth={1.8} />
                    서비스 종료일
                  </div>
                  <p className="text-right text-[14px] font-semibold text-[#273142]">
                    {formatServiceEndDate(summary)}
                  </p>
                </div>
                <div className="flex items-start justify-between gap-5 px-4 py-4">
                  <div className="flex items-center gap-2 text-[13px] font-medium text-[#7b8491]">
                    <CreditCard className="h-4 w-4 text-[#64748b]" strokeWidth={1.8} />
                    마지막 이용 플랜
                  </div>
                  <p className="text-right text-[14px] font-semibold text-[#273142]">
                    {summary.currentPlanCode === "free"
                      ? "무료 체험 플랜"
                      : getOwnerPlanDisplayName(summary.currentPlanCode)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-[12px] border border-[#bfdbfe] bg-[#eff6ff] px-4 py-4">
              <p className="text-[14px] font-semibold text-[#1d4ed8]">지금 연장하면 바로 이용할 수 있습니다</p>
              <p className="mt-2 text-[13px] leading-5 text-[#58709a]">
                매장 운영 규모에 맞는 플랜을 선택하고 결제를 완료해 주세요.
              </p>
            </div>

            <a
              href={`/owner/billing?compare=1&notice=${isPastDue ? "past_due" : "expired"}&plan=${resumePlanCode}`}
              className="mt-5 inline-flex h-[48px] w-full items-center justify-center gap-2 rounded-[8px] bg-[#2563eb] px-5 text-[14px] font-semibold text-white shadow-[0_10px_22px_rgba(37,99,235,0.20)] transition hover:bg-[#1d4ed8] focus:outline-none focus:ring-4 focus:ring-[#bfdbfe]"
            >
              서비스 기간 연장하기
              <ArrowRight className="h-4 w-4" strokeWidth={2.2} />
            </a>

            <a
              href={supportHref}
              className="mt-3 inline-flex h-[44px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#dbe2ea] bg-white px-5 text-[14px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
            >
              <Headphones className="h-4 w-4" strokeWidth={1.8} />
              결제·기간 연장 문의
            </a>

            <div className="mt-auto border-t border-[#e7edf3] pt-5">
              <p className="text-[12px] leading-5 text-[#8b95a3]">
                결제 완료 후에도 화면이 바뀌지 않으면 새로고침하거나 고객센터로 문의해 주세요.
              </p>
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
