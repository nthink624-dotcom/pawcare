import {
  CalendarCheck2,
  CreditCard,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import type {
  MarketingKpiOperationalSourceState,
  MarketingKpiSnapshot,
} from "@/types/marketing-kpi";

type TruthLabel =
  | "codex_live"
  | "local_snapshot"
  | "manual"
  | "fixture"
  | "unavailable";

export default function AdminMarketingKpiPanel({
  snapshot,
  error,
  loading,
}: {
  snapshot: MarketingKpiSnapshot | null;
  error: string | null;
  loading: boolean;
}) {
  const hasError = Boolean(error);

  return (
    <section aria-labelledby="marketing-kpi-heading" className="mt-5 border-t border-[#e2e8f0] pt-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#64748b]`}>핵심 KPI</p>
          <h2
            id="marketing-kpi-heading"
            className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}
          >
            가입 · 첫 유효 예약 · 첫 구독 결제
          </h2>
        </div>
        <p className={`${ADMIN_TYPOGRAPHY.helper} text-[#64748b]`}>
          {snapshot && !hasError
            ? formatKpiDateRange(snapshot)
            : "최근 7일 집계 상태를 확인합니다."}
        </p>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <KpiCard
          icon={UserRoundCheck}
          label="가입"
          current={snapshot?.current.signupCompleted}
          previous={snapshot?.previous.signupCompleted}
          changePercent={snapshot?.changes.signupCompletedPercent}
          sourceState={snapshot?.sources.signups}
          truthLabel={resolveTruthLabel(snapshot, snapshot?.sources.signups, hasError)}
          hasError={hasError}
          nextCondition="가입 완료 원본 집계가 연결되면 표시됩니다."
        />
        <KpiCard
          icon={CalendarCheck2}
          label="첫 유효 예약"
          current={snapshot?.current.activatedShops}
          previous={snapshot?.previous.activatedShops}
          changePercent={snapshot?.changes.activatedShopsPercent}
          rate={snapshot?.current.signupToActivationRate}
          sourceState={snapshot?.sources.appointments}
          truthLabel={resolveTruthLabel(snapshot, snapshot?.sources.appointments, hasError)}
          hasError={hasError}
          nextCondition="가입 후 첫 유효 예약 집계가 연결되면 표시됩니다."
        />
        <KpiCard
          icon={CreditCard}
          label="첫 구독 결제"
          current={snapshot?.current.paidConversions}
          previous={snapshot?.previous.paidConversions}
          changePercent={snapshot?.changes.paidConversionsPercent}
          rate={snapshot?.current.signupToPaidRate}
          sourceState={snapshot?.sources.subscriptionPayments}
          truthLabel={resolveTruthLabel(
            snapshot,
            snapshot?.sources.subscriptionPayments,
            hasError,
          )}
          hasError={hasError}
          nextCondition="첫 구독 결제 완료 집계가 연결되면 표시됩니다."
        />
      </div>

      {loading && !snapshot ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.helper}`}
        >
          집계 연결 상태를 확인하고 있습니다.
        </p>
      ) : null}

      {error ? (
        <p
          role="status"
          aria-live="polite"
          className={`mt-3 rounded-[8px] border border-[#e8cfd4] bg-[#fffafa] px-4 py-3 text-[#a04455] ${ADMIN_TYPOGRAPHY.body}`}
        >
          KPI 집계를 확인하지 못했습니다. 숫자 0으로 대신 표시하지 않습니다.
        </p>
      ) : null}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  current,
  previous,
  changePercent,
  rate,
  sourceState,
  truthLabel,
  hasError,
  nextCondition,
}: {
  icon: LucideIcon;
  label: string;
  current: number | null | undefined;
  previous: number | null | undefined;
  changePercent: number | null | undefined;
  rate?: number | null;
  sourceState: MarketingKpiOperationalSourceState | undefined;
  truthLabel: TruthLabel;
  hasError: boolean;
  nextCondition: string;
}) {
  const measured =
    !hasError &&
    sourceState === "measured" &&
    truthLabel !== "unavailable" &&
    current != null;

  return (
    <article className="min-w-0 rounded-[10px] border border-[#dce2e8] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] ${
            measured
              ? "bg-[#edf6f2] text-[#1f6b5b]"
              : "bg-[#f1f5f9] text-[#64748b]"
          }`}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span
          className={`max-w-full break-all rounded-full border px-2.5 py-1 ${ADMIN_TYPOGRAPHY.badge} ${
            measured
              ? "border-[#cfe5dc] bg-[#f4faf7] text-[#1f6b5b]"
              : "border-[#dbe2ea] bg-[#f8fafc] text-[#64748b]"
          }`}
        >
          {truthLabel}
        </span>
      </div>
      <p className={`mt-3 text-[#64748b] ${ADMIN_TYPOGRAPHY.meta}`}>{label}</p>
      <p className={`mt-1 text-[#111827] ${ADMIN_TYPOGRAPHY.sectionTitle}`}>
        {hasError
          ? "집계 확인 불가"
          : measured
            ? `${current.toLocaleString("ko-KR")}건`
            : "집계 미연결"}
      </p>
      <p className={`mt-1 text-[#64748b] ${ADMIN_TYPOGRAPHY.body}`}>
        {hasError
          ? nextCondition
          : measured
          ? [
              rate === undefined ? null : formatKpiRate(rate),
              formatKpiComparison(previous, changePercent),
            ]
              .filter(Boolean)
              .join(" · ")
          : nextCondition}
      </p>
    </article>
  );
}

function resolveTruthLabel(
  snapshot: MarketingKpiSnapshot | null,
  sourceState: MarketingKpiOperationalSourceState | undefined,
  hasError: boolean,
): TruthLabel {
  if (hasError) return "unavailable";
  if (!snapshot || sourceState !== "measured") return "unavailable";
  if (snapshot.source.environment === "production") return "codex_live";
  if (snapshot.source.environment === "development") return "local_snapshot";
  return "unavailable";
}

function formatKpiRate(value: number | null | undefined) {
  if (value == null) return "전환율 집계 없음";
  return `전환율 ${value.toLocaleString("ko-KR")}%`;
}

function formatKpiComparison(
  previous: number | null | undefined,
  changePercent: number | null | undefined,
) {
  if (previous == null) return "직전 7일 집계 없음";
  if (changePercent == null) {
    return `직전 7일 ${previous.toLocaleString("ko-KR")}건`;
  }
  const prefix = changePercent > 0 ? "+" : "";
  return `직전 7일 ${previous.toLocaleString("ko-KR")}건 대비 ${prefix}${changePercent.toLocaleString("ko-KR")}%`;
}

function formatKpiDateRange(snapshot: MarketingKpiSnapshot) {
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    timeZone: snapshot.range.timeZone,
  });
  return `${formatter.format(new Date(snapshot.range.current.from))} ~ ${formatter.format(
    new Date(snapshot.range.current.to),
  )} · 직전 7일 비교`;
}
