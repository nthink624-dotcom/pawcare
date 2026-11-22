import { NextRequest } from "next/server";
import { revenueCsvCell, revenueTransactionCsvRows, paymentMethodLabels } from "@/lib/revenue-analytics";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { loadRevenueAnalytics, loadRevenueTransactions, parseRevenueQuery, RevenueAnalyticsError } from "@/server/revenue-analytics";

export const dynamic = "force-dynamic";
/** Bounded chunks at one snapshot: no truncation and no partially downloaded file on failure. */
export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    if (!shopId || ["demo-shop", "owner-demo"].includes(shopId)) throw new RevenueAnalyticsError("데모 화면에서는 실제 매출 자료를 내려받을 수 없습니다.", 403);
    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);
    const query = parseRevenueQuery(request.nextUrl.searchParams);
    const page = await loadRevenueTransactions(owner.shopId, query, 500);
    const frozenQuery = { ...query, cashSnapshot: page.cashSnapshot, outstandingRevision: page.outstandingRevision };
    let prefix = "";
    if (query.page === 1) {
      const report = await loadRevenueAnalytics(owner.shopId, frozenQuery);
      const metadata: unknown[][] = [["조회 기간", `${query.period.from} ~ ${query.period.to}`], ["비교 기간", `${query.period.previousFrom} ~ ${query.period.previousTo}`], ["담당자", query.filters.staffId ? report.staffOptions.find(row => row.id === query.filters.staffId)?.name ?? "미지정" : "전체"], ["결제수단", paymentMethodLabels[query.filters.paymentMethod]], ["조회 시각", query.snapshotAt], ["수금액", report.summary.collectedAmount], ["환불액", report.summary.refundAmount], ["환불 차감 수금 매출", report.summary.netAmount], ["결제 시 적용 할인", report.summary.discountAmount], ["수금 건수", report.summary.paidCount], ["미수·확인 필요 금액", report.outstanding.amount], ["미수 기준", `이용일 ${query.period.to}까지 · 결제수단 필터 제외`], ["내역 구분", query.view === "outstanding" ? "미수·확인 필요" : "수금·환불"], [], ["거래일시(한국)", "구분", "항목", "담당자", "결제수단", "금액(원)", "적용할인(원)", "원장번호"]];
      prefix = metadata.map(row => row.map(revenueCsvCell).join(",")).join("\r\n") + "\r\n";
    }
    return ownerMobileCorsJson(request, { csv: prefix + revenueTransactionCsvRows(page.transactions).join("\r\n") + (page.transactions.length ? "\r\n" : ""), snapshotAt: query.snapshotAt, cashSnapshot: page.cashSnapshot, outstandingRevision: page.outstandingRevision, total: page.total, page: query.page, done: query.page * 500 >= page.total, filename: `펫매니저_매출_${query.period.from}_${query.period.to}_${query.view}.csv` }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const known = error instanceof OwnerApiError || error instanceof RevenueAnalyticsError;
    return ownerMobileCorsJson(request, { message: known ? error.message : "매출 자료를 내려받지 못했습니다." }, { status: known ? error.status : 500 });
  }
}
export async function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request); }
