import { z } from "zod";
import { revenuePaymentMethods, type RevenueAnalyticsPayload, type RevenueCashMutation, type RevenueFilters, type RevenuePeriod, type RevenuePreset, type RevenueTransaction, type RevenueView } from "@petmanager/shared/contracts/revenue-analytics";
import { resolveRevenuePeriod, validRevenueDate } from "@/lib/revenue-analytics";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { OwnerShopContext } from "@/server/owner-api-auth";

export class RevenueAnalyticsError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
const presets = ["today", "yesterday", "month", "previous_month", "quarter", "year", "custom"] as const;
const querySchema = z.object({
  preset: z.enum(presets).default("month"), from: z.string().optional(), to: z.string().optional(),
  staffId: z.string().max(100).default(""), paymentMethod: z.enum(["all", ...revenuePaymentMethods]).default("all"),
  view: z.enum(["payments", "outstanding"]).default("payments"), page: z.coerce.number().int().min(1).max(1_000_000).default(1),
  kind: z.enum(["all", "payment", "refund"]).default("all"),
  date: z.string().optional(), snapshotAt: z.string().datetime({ offset: true }).optional(),
  cashSnapshot: z.string().max(16384).regex(/^\d{1,20}:\d{1,20}:(?:\d{1,20}(?:,\d{1,20})*)?$/).optional(),
  outstandingRevision: z.string().regex(/^[a-f0-9]{32}$/).optional(),
});
export type RevenueQuery = { period: RevenuePeriod; filters: RevenueFilters; view: RevenueView; page: number; snapshotAt: string; cashSnapshot?: string; outstandingRevision?: string };
export function parseRevenueQuery(params: URLSearchParams, now = new Date()): RevenueQuery {
  const query = querySchema.safeParse(Object.fromEntries(params));
  if (!query.success) throw new RevenueAnalyticsError("조회 조건을 확인해 주세요.");
  const value = query.data;
  if (value.snapshotAt && !value.cashSnapshot) throw new RevenueAnalyticsError("매출 조회 방식이 업데이트되었습니다. 새로고침해 주세요.", 409);
  const snapshotAt = value.snapshotAt ?? now.toISOString();
  if (Date.parse(snapshotAt) > now.getTime() + 60_000 || Date.parse(snapshotAt) < now.getTime() - 86_400_000) throw new RevenueAnalyticsError("조회 결과가 오래되었습니다. 새로고침해 주세요.", 409);
  // Pagination/export must retain the original Korea calendar period after midnight.
  const periodNow = new Date(Math.min(Date.parse(snapshotAt), now.getTime()));
  let period: RevenuePeriod;
  try { period = resolveRevenuePeriod(value.preset as RevenuePreset, { from: value.from ?? "", to: value.to ?? "" }, periodNow); }
  catch (error) { throw new RevenueAnalyticsError(error instanceof Error ? error.message : "조회 기간을 확인해 주세요."); }
  if (value.date && (!validRevenueDate(value.date) || value.date < period.from || value.date > period.to)) throw new RevenueAnalyticsError("거래 날짜를 확인해 주세요.");
  return { period, filters: { staffId: value.staffId, paymentMethod: value.paymentMethod, ...(value.date ? { date: value.date } : {}), ...(value.kind !== "all" ? { eventType: value.kind } : {}) }, view: value.view, page: value.page, snapshotAt, cashSnapshot: value.cashSnapshot, outstandingRevision: value.outstandingRevision };
}
const cashSchema = z.object({
  requestId: z.string().uuid(), entryId: z.string().uuid(), type: z.enum(["payment", "refund"]),
  occurredAt: z.string().datetime({ offset: true }),
  tenders: z.array(z.object({ method: z.enum(revenuePaymentMethods), amount: z.number().int().min(1).max(999_999_999) }).strict()).min(1).max(6),
  paymentEventId: z.string().uuid().optional(),
}).strict();
export function parseRevenueCashMutation(value: unknown, now = new Date()): RevenueCashMutation {
  const result = cashSchema.safeParse(value);
  if (!result.success) throw new RevenueAnalyticsError("수금·환불 금액과 결제수단을 확인해 주세요.");
  if (Date.parse(result.data.occurredAt) > now.getTime() + 60_000 || Date.parse(result.data.occurredAt) < Date.parse("2000-01-01T00:00:00Z")) throw new RevenueAnalyticsError("실제로 수금·환불한 날짜를 확인해 주세요.");
  if ((result.data.type === "refund") !== Boolean(result.data.paymentEventId)) throw new RevenueAnalyticsError("환불할 원래 수금 내역을 선택해 주세요.");
  if (result.data.type === "refund" && result.data.tenders.length !== 1) throw new RevenueAnalyticsError("원래 결제수단별로 환불을 기록해 주세요.");
  return result.data;
}
function adminClient() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new RevenueAnalyticsError("매출 서버 연결을 확인할 수 없습니다.", 503);
  return admin;
}
function throwRpcError(error: { code?: string; message?: string }) {
  const message = error.message ?? "";
  if (error.code === "PGRST202" || error.code === "42P01" || error.code === "42703") throw new RevenueAnalyticsError("수금 원장 업데이트가 필요합니다. 관리자에게 문의해 주세요.", 503);
  if (message.includes("ACCESS_DENIED")) throw new RevenueAnalyticsError("이 매장의 매출을 변경할 권한이 없습니다.", 403);
  if (message.includes("ACCOUNT_DELETION_PENDING")) throw new RevenueAnalyticsError("계정 삭제가 진행 중인 매장에는 수금·환불 기록을 추가할 수 없습니다.", 409);
  if (message.includes("NOT_FOUND")) throw new RevenueAnalyticsError("원래 거래를 찾을 수 없습니다. 새로고침해 주세요.", 404);
  if (message.includes("EXCEEDS_DUE")) throw new RevenueAnalyticsError("남은 미수금보다 큰 금액은 수금할 수 없습니다. 최신 내역을 확인해 주세요.", 409);
  if (message.includes("EXCEEDS_PAYMENT")) throw new RevenueAnalyticsError("환불 가능 금액과 원래 결제수단·날짜를 확인해 주세요.", 409);
  if (message.includes("REQUEST_CONFLICT") || error.code === "23505") throw new RevenueAnalyticsError("동일한 저장 요청의 내용이 달라졌습니다. 최신 내역을 확인해 주세요.", 409);
  if (error.code === "22023") throw new RevenueAnalyticsError("저장할 거래 금액·날짜·결제수단을 확인해 주세요.");
  throw new RevenueAnalyticsError("매출 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.", 500);
}
export function revenueRpcFilters(shopId: string, query: RevenueQuery) {
  return { p_shop_id: shopId, p_from: query.period.from, p_to: query.period.to, p_staff_id: query.filters.staffId, p_method: query.filters.paymentMethod, p_snapshot_at: query.snapshotAt, p_cash_snapshot: query.cashSnapshot ?? null };
}
function validateSnapshot(data: { cashSnapshot?: string; outstandingRevision?: string }, query: RevenueQuery) {
  if (!data.cashSnapshot || !data.outstandingRevision) throw new RevenueAnalyticsError("매출 조회 기준을 확인하지 못했습니다.", 502);
  if (query.outstandingRevision && data.outstandingRevision !== query.outstandingRevision) throw new RevenueAnalyticsError("미수 내역이 변경되었습니다. 새로고침 후 다시 조회하거나 내려받아 주세요.", 409);
}
export async function loadRevenueTransactions(shopId: string, query: RevenueQuery, pageSize = 25) {
  const result = await adminClient().rpc("owner_revenue_transactions_v2", { ...revenueRpcFilters(shopId, query), p_view: query.view, p_page: query.page, p_page_size: pageSize, p_date: query.filters.date ?? null, p_event_type: query.filters.eventType ?? "" });
  if (result.error) throwRpcError(result.error);
  const data = result.data as { transactions: RevenueTransaction[]; total: number; cashSnapshot: string; outstandingRevision: string } | null;
  if (!data || !Array.isArray(data.transactions) || !Number.isSafeInteger(data.total)) throw new RevenueAnalyticsError("매출 내역 응답을 확인하지 못했습니다.", 502);
  validateSnapshot(data, query);
  return data;
}
export async function loadRevenueAnalytics(shopId: string, query: RevenueQuery): Promise<RevenueAnalyticsPayload> {
  const report = await adminClient().rpc("owner_revenue_report_v2", { ...revenueRpcFilters(shopId, query), p_previous_from: query.period.previousFrom, p_previous_to: query.period.previousTo });
  if (report.error) throwRpcError(report.error);
  const result = report.data as Omit<RevenueAnalyticsPayload, "contractVersion" | "generatedAt" | "period" | "filters" | "transactions" | "pagination"> | null;
  if (!result?.summary || !Array.isArray(result.daily) || !Array.isArray(result.categories)) throw new RevenueAnalyticsError("매출 집계 응답을 확인하지 못했습니다.", 502);
  validateSnapshot(result, query);
  const details = await loadRevenueTransactions(shopId, { ...query, cashSnapshot: result.cashSnapshot, outstandingRevision: result.outstandingRevision });
  return { ...result, contractVersion: 2, generatedAt: query.snapshotAt, period: query.period, filters: query.filters, transactions: details.transactions, pagination: { page: query.page, pageSize: 25, total: details.total, view: query.view } };
}
export async function recordRevenueCash(owner: OwnerShopContext, body: unknown) {
  if (!owner.userId || !["owner", "manager"].includes(owner.role)) throw new RevenueAnalyticsError("매출을 변경할 권한이 없습니다.", 403);
  const value = parseRevenueCashMutation(body);
  const result = await adminClient().rpc("record_owner_revenue_cash_v2", { p_shop_id: owner.shopId, p_actor_user_id: owner.userId, p_request_id: value.requestId, p_entry_id: value.entryId, p_event_type: value.type, p_occurred_at: value.occurredAt, p_tenders: value.tenders, p_payment_event_id: value.paymentEventId ?? null });
  if (result.error) throwRpcError(result.error);
  return result.data as { requestId: string; reused: boolean };
}
