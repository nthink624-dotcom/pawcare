import type { RevenueAnalyticsPayload, RevenuePeriod, RevenuePreset, RevenueTransaction } from "@petmanager/shared/contracts/revenue-analytics";

export const paymentMethodLabels = { all: "전체 결제수단", card: "카드", cash: "현금", transfer: "계좌이체", easy_pay: "간편결제", other: "기타", unknown: "미입력" } as const;
export const revenuePresetLabels: Record<RevenuePreset, string> = { today: "오늘", yesterday: "어제", month: "이번 달", previous_month: "지난달", quarter: "최근 3개월", year: "올해", custom: "직접 선택" };
const dayMs = 86_400_000;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const asDate = (date: string) => new Date(`${date}T00:00:00Z`);
export function revenueToday(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function validRevenueDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(asDate(value).getTime()) && iso(asDate(value)) === value;
}
export function shiftRevenueMonth(value: string, months: number): string {
  const date = asDate(value);
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const lastDay = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  first.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return iso(first);
}
export function resolveRevenuePeriod(preset: RevenuePreset, custom?: { from: string; to: string }, now = new Date()): RevenuePeriod {
  const today = revenueToday(now);
  const monthStart = today.slice(0, 7) + "-01";
  let from = today;
  let to = today;
  if (preset === "yesterday") from = to = iso(new Date(asDate(today).getTime() - dayMs));
  if (preset === "month") from = monthStart;
  if (preset === "previous_month") { from = shiftRevenueMonth(monthStart, -1); to = iso(new Date(asDate(monthStart).getTime() - dayMs)); }
  if (preset === "quarter") from = shiftRevenueMonth(monthStart, -2);
  if (preset === "year") from = today.slice(0, 4) + "-01-01";
  if (preset === "custom") { from = custom?.from ?? ""; to = custom?.to ?? ""; }
  if (!validRevenueDate(from) || !validRevenueDate(to) || from > to || to > today || from < "2000-01-01" || (asDate(to).getTime() - asDate(from).getTime()) / dayMs > 1095) {
    throw new Error("조회 기간을 확인해 주세요. 미래 날짜를 제외하고 최대 3년까지 선택할 수 있습니다.");
  }
  let previousFrom: string;
  let previousTo: string;
  if (["month", "previous_month", "quarter", "year"].includes(preset)) {
    const months = preset === "year" ? -12 : preset === "quarter" ? -3 : -1;
    previousFrom = shiftRevenueMonth(from, months);
    previousTo = shiftRevenueMonth(to, months);
    // Full calendar months compare with the full preceding month, including its final day.
    if (preset === "previous_month") previousTo = iso(new Date(asDate(from).getTime() - dayMs));
  } else {
    const days = Math.round((asDate(to).getTime() - asDate(from).getTime()) / dayMs) + 1;
    previousTo = iso(new Date(asDate(from).getTime() - dayMs));
    previousFrom = iso(new Date(asDate(from).getTime() - days * dayMs));
  }
  return { preset, from, to, previousFrom, previousTo };
}
export function revenueComparison(current: number, previous: number, previousEvents: number) {
  if (previousEvents === 0) return `이전 기간 거래 없음 · 차이 ${formatRevenueWon(current - previous)}`;
  if (previous === 0) return `이전 기간 0원 · 차이 ${formatRevenueWon(current)}`;
  const percent = Math.round((current - previous) / Math.abs(previous) * 100);
  return `이전 기간보다 ${percent > 0 ? "+" : ""}${percent}%`;
}
export function formatRevenueWon(value: number) { return `${Math.round(value).toLocaleString("ko-KR")}원`; }
export type RevenueChartBucket = { from: string; to: string; label: string; amount: number };
export function buildRevenueChart(payload: Pick<RevenueAnalyticsPayload, "period" | "daily">): RevenueChartBucket[] {
  const { from, to, preset } = payload.period;
  const days = Math.round((asDate(to).getTime() - asDate(from).getTime()) / dayMs) + 1;
  const unit = preset === "year" || days > 120 ? "month" : days > 40 ? "week" : "day";
  const buckets: RevenueChartBucket[] = [];
  let cursor = from;
  while (cursor <= to) {
    const start = asDate(cursor);
    const next = unit === "month" ? new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)) : new Date(start.getTime() + (unit === "week" ? 7 : 1) * dayMs);
    const end = [iso(new Date(next.getTime() - dayMs)), to].sort()[0];
    buckets.push({ from: cursor, to: end, label: unit === "month" ? `${Number(cursor.slice(5, 7))}월` : cursor.slice(5).replace("-", "/"), amount: payload.daily.filter(row => row.date >= cursor && row.date <= end).reduce((sum, row) => sum + row.netAmount, 0) });
    cursor = iso(next);
  }
  return buckets;
}
export function revenueCsvCell(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  const text = String(value ?? "");
  const safe = /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}
export function revenueTransactionCsvRows(rows: RevenueTransaction[]) {
  return rows.map(row => [row.occurredAt ? new Date(row.occurredAt).toLocaleString("sv-SE", { timeZone: "Asia/Seoul" }) : row.appointmentDate, row.eventType === "payment" ? "수금" : row.eventType === "refund" ? "환불" : row.confirmationRequired ? "수금 확인 필요" : "미수", row.title, row.staffName, paymentMethodLabels[row.paymentMethod], row.amount, row.discountAmount, row.entryId].map(revenueCsvCell).join(","));
}
