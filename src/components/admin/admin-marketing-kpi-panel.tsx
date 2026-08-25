import {
  CalendarCheck2,
  CreditCard,
  MousePointerClick,
  UserRoundCheck,
  type LucideIcon,
} from "lucide-react";

import { getDotIndicatorClass } from "@/components/owner-web/status-indicators";
import type { MarketingKpiSnapshot } from "@/types/marketing-kpi";

export default function AdminMarketingKpiPanel({
  snapshot,
  error,
  loading,
}: {
  snapshot: MarketingKpiSnapshot | null;
  error: string | null;
  loading: boolean;
}) {
  const sourceLabel = !snapshot
    ? "데이터 확인 중"
    : snapshot.source.environment === "production"
      ? "운영 데이터"
      : snapshot.source.environment === "development"
        ? "개발 데이터"
        : "환경 확인 필요";
  const availabilityLabel = !snapshot
    ? "확인 중"
    : snapshot.availability === "ready"
      ? "집계 연결됨"
      : snapshot.availability === "partial"
        ? "일부 확인 불가"
        : "연결 확인 필요";

  return (
    <section className="mt-3 rounded-[10px] border border-[#dbe7e2] bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[#1f6b5b]">실제 운영 KPI · 최근 7일</p>
          <h2 className="mt-1 text-[18px] font-semibold text-[#111827]">
            가입 → 첫 예약 → 첫 구독 결제
          </h2>
          <p className="mt-1 text-[12px] text-[#64748b]">
            {snapshot ? formatKpiDateRange(snapshot) : "같은 길이의 직전 7일과 비교합니다."}
          </p>
        </div>
        <span className="rounded-full border border-[#dbe2ea] bg-[#f8fafc] px-2.5 py-1 text-[11px] font-semibold text-[#607080]">
          {sourceLabel} · {availabilityLabel}
        </span>
      </div>

      {error ? (
        <p className="mt-3 rounded-[8px] border border-[#f0d1d1] bg-[#fff7f7] px-3 py-2 text-[13px] text-[#a04455]">
          {error}
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={MousePointerClick}
          label="랜딩 방문·유입"
          value="미연결"
          measured={false}
          detail="방문·CTA·UTM 계측이 없어 0으로 표시하지 않습니다."
        />
        <KpiCard
          icon={UserRoundCheck}
          label="가입 완료"
          value={formatKpiCount(snapshot?.current.signupCompleted, loading)}
          measured={snapshot?.sources.signups === "measured"}
          detail={formatKpiComparison(
            snapshot?.current.signupCompleted,
            snapshot?.previous.signupCompleted,
            snapshot?.changes.signupCompletedPercent,
            loading,
          )}
        />
        <KpiCard
          icon={CalendarCheck2}
          label="예약 활성화"
          value={formatKpiCount(snapshot?.current.activatedShops, loading)}
          measured={snapshot?.sources.appointments === "measured"}
          detail={`${formatKpiRate(snapshot?.current.signupToActivationRate, loading)} · ${formatKpiComparison(
            snapshot?.current.activatedShops,
            snapshot?.previous.activatedShops,
            snapshot?.changes.activatedShopsPercent,
            loading,
          )}`}
        />
        <KpiCard
          icon={CreditCard}
          label="유료 전환"
          value={formatKpiCount(snapshot?.current.paidConversions, loading)}
          measured={snapshot?.sources.subscriptionPayments === "measured"}
          detail={`${formatKpiRate(snapshot?.current.signupToPaidRate, loading)} · ${formatKpiComparison(
            snapshot?.current.paidConversions,
            snapshot?.previous.paidConversions,
            snapshot?.changes.paidConversionsPercent,
            loading,
          )}`}
        />
      </div>

      {snapshot ? (
        <div className="mt-3 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] px-3 py-3">
          <p className="text-[12px] font-semibold text-[#334155]">
            활성화는 가입 후 첫 유효 예약, 유료 전환은 첫 구독 결제 완료로 계산합니다.
          </p>
          <ul className="mt-1.5 space-y-1 text-[11px] leading-5 text-[#64748b]">
            {snapshot.warnings.slice(0, 3).map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-[#94a3b8]">
            마지막 집계 {formatCheckedAt(snapshot.checkedAt)} · 개인정보와 개별 매장 ID는 화면으로 보내지 않습니다.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  detail,
  measured,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  measured: boolean;
}) {
  const dotClass = getDotIndicatorClass(measured ? "confirmed" : "neutral");

  return (
    <div className="rounded-[10px] border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] bg-[#edf6f2] text-[#1f6b5b]">
          <Icon className="h-4 w-4" />
        </span>
        <span className={dotClass} aria-hidden="true" />
      </div>
      <p className="mt-3 text-[12px] text-[#64748b]">{label}</p>
      <p className="mt-0.5 text-[17px] font-semibold text-[#111827]">{value}</p>
      <p className="mt-1 min-h-10 text-[12px] leading-5 text-[#64748b]">{detail}</p>
    </div>
  );
}

function formatKpiCount(value: number | null | undefined, loading: boolean) {
  if (loading && value == null) return "확인 중";
  if (value == null) return "확인 불가";
  return `${value.toLocaleString("ko-KR")}건`;
}

function formatKpiRate(value: number | null | undefined, loading: boolean) {
  if (loading && value == null) return "전환율 확인 중";
  if (value == null) return "전환율 확인 불가";
  return `전환율 ${value.toLocaleString("ko-KR")}%`;
}

function formatKpiComparison(
  current: number | null | undefined,
  previous: number | null | undefined,
  changePercent: number | null | undefined,
  loading: boolean,
) {
  if (loading && current == null) return "직전 기간 비교 확인 중";
  if (current == null || previous == null) return "직전 기간 비교 불가";
  if (changePercent == null) return `직전 7일 ${previous.toLocaleString("ko-KR")}건`;
  const prefix = changePercent > 0 ? "+" : "";
  return `직전 ${previous.toLocaleString("ko-KR")}건 대비 ${prefix}${changePercent.toLocaleString("ko-KR")}%`;
}

function formatKpiDateRange(snapshot: MarketingKpiSnapshot) {
  const formatter = new Intl.DateTimeFormat("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: snapshot.range.timeZone,
  });
  return `${formatter.format(new Date(snapshot.range.current.from))} ~ ${formatter.format(
    new Date(snapshot.range.current.to),
  )} · 같은 길이의 직전 7일과 비교`;
}

function formatCheckedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}
