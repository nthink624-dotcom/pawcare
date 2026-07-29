"use client";

import Link from "next/link";
import { ChevronRight, RefreshCcw } from "lucide-react";

import {
  formatAdminDateTime,
  formatWon,
  type AdminRevenueSummary,
} from "@/components/admin/admin-dashboard-model";

export default function AdminRevenueOverview({
  summary,
  error,
  onRefresh,
}: {
  summary: AdminRevenueSummary | null;
  error: string | null;
  onRefresh: () => void;
}) {
  return (
    <section className="rounded-[10px] border border-[#e2e8f0] bg-white">
      <header className="flex items-center justify-between gap-3 border-b border-[#eef2f6] px-4 py-3">
        <div>
          <h2 className="text-[17px] font-semibold text-[#111827]">매출</h2>
          <p className="mt-0.5 text-[13px] text-[#64748b]">
            오너 구독 결제 기준
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-8 w-8 items-center justify-center rounded-[7px] border border-[#dbe2ea] text-[#64748b] hover:bg-[#f8fafc]"
          aria-label="매출 새로고침"
        >
          <RefreshCcw className="h-4 w-4" />
        </button>
      </header>

      {error ? (
        <p className="m-4 rounded-[7px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]">
          {error}
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-px bg-[#eef2f6]">
        <Metric
          label="이번 달"
          value={formatWon(summary?.monthRevenue ?? 0)}
        />
        <Metric
          label="예상 월 매출"
          value={formatWon(summary?.expectedMonthlyRecurringRevenue ?? 0)}
        />
        <Metric
          label="오늘"
          value={formatWon(summary?.todayRevenue ?? 0)}
        />
        <Metric
          label="유료 이용 매장"
          value={`${summary?.activePaidSubscriptions ?? 0}곳`}
        />
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-[14px] font-semibold text-[#334155]">최근 결제</h3>
          <span className="text-[12px] text-[#94a3b8]">
            이번 달 {summary?.monthPaidCount ?? 0}건
          </span>
        </div>
        <div className="mt-2 divide-y divide-[#eef2f6]">
          {(summary?.recentPayments ?? []).slice(0, 5).map((payment) => (
            <div
              key={payment.paymentId}
              className="flex items-center justify-between gap-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-[13px] font-medium text-[#111827]">
                  {payment.planName}
                </p>
                <p className="mt-0.5 truncate text-[12px] text-[#94a3b8]">
                  {formatAdminDateTime(payment.paidAt)}
                </p>
              </div>
              <p className="shrink-0 text-[13px] font-semibold text-[#2563eb]">
                {formatWon(payment.amount)}
              </p>
            </div>
          ))}
          {(summary?.recentPayments ?? []).length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[#94a3b8]">
              최근 결제가 없습니다.
            </p>
          ) : null}
        </div>
      </div>

      <Link
        href="/owner/admin"
        className="flex h-10 items-center justify-between border-t border-[#eef2f6] px-4 text-[13px] font-semibold text-[#1f6b5b] hover:bg-[#f7fbf9]"
      >
        오너 계정 관리
        <ChevronRight className="h-4 w-4" />
      </Link>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-3">
      <p className="text-[12px] text-[#64748b]">{label}</p>
      <p className="mt-1 truncate text-[18px] font-semibold tracking-[-0.02em] text-[#111827]">
        {value}
      </p>
    </div>
  );
}
