import type { RevenueAnalyticsPayload, RevenueGroup, RevenueTransaction } from "@petmanager/shared/contracts/revenue-analytics";
import type { RevenueQuery } from "@/server/revenue-analytics";

/** Public demo only. No fixture can be used as a real-shop fallback. */
export function buildDemoRevenueAnalytics(query: RevenueQuery): RevenueAnalyticsPayload {
  const day = query.period.to;
  const priorDay = new Date(Date.parse(day + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  const all: RevenueTransaction[] = [
    { id: "demo-cash-1", entryId: "demo-sale-1", appointmentId: null, appointmentDate: day, occurredAt: day + "T03:00:00Z", title: "전체 미용", guardianName: "데모 보호자", petName: "데모 두부", staffName: "데모 원장", eventType: "payment", paymentMethod: "card", amount: 65000, discountAmount: 5000, refundableAmount: 65000, confirmationRequired: false },
    { id: "demo-cash-2", entryId: "demo-sale-2", appointmentId: null, appointmentDate: priorDay, occurredAt: priorDay + "T03:00:00Z", title: "목욕", guardianName: "데모 보호자", petName: "데모 보리", staffName: "데모 원장", eventType: "payment", paymentMethod: "cash", amount: 35000, discountAmount: 0, refundableAmount: 20000, confirmationRequired: false },
    { id: "demo-refund", entryId: "demo-sale-2", appointmentId: null, appointmentDate: priorDay, occurredAt: day + "T04:00:00Z", title: "목욕", guardianName: "데모 보호자", petName: "데모 보리", staffName: "데모 원장", eventType: "refund", paymentMethod: "cash", amount: -15000, discountAmount: 0, refundableAmount: 0, confirmationRequired: false },
  ];
  const rows = all.filter(row => row.occurredAt.slice(0, 10) >= query.period.from && row.occurredAt.slice(0, 10) <= query.period.to && (query.filters.paymentMethod === "all" || row.paymentMethod === query.filters.paymentMethod) && (!query.filters.staffId || query.filters.staffId === "demo-staff"));
  const group = (key: (row: RevenueTransaction) => string) => {
    const map = new Map<string, RevenueGroup>();
    for (const row of rows) { const name = key(row); const previous = map.get(name) ?? { key: name, name, collectedAmount: 0, refundAmount: 0, netAmount: 0, count: 0 }; previous.collectedAmount += Math.max(row.amount, 0); previous.refundAmount += Math.max(-row.amount, 0); previous.netAmount += row.amount; previous.count += 1; map.set(name, previous); }
    return [...map.values()];
  };
  const collectedAmount = rows.reduce((sum, row) => sum + Math.max(row.amount, 0), 0);
  const refundAmount = rows.reduce((sum, row) => sum + Math.max(-row.amount, 0), 0);
  const pending: RevenueTransaction = { id: "demo-due", entryId: "demo-due", appointmentId: null, appointmentDate: day, occurredAt: "", title: "전체 미용", guardianName: "데모 보호자", petName: "데모 몽이", staffName: "데모 원장", eventType: "outstanding", paymentMethod: "unknown", amount: 50000, discountAmount: 0, refundableAmount: 0, confirmationRequired: true };
  const details = query.view === "outstanding" ? [pending] : rows.filter(row => (!query.filters.date || row.occurredAt.startsWith(query.filters.date)) && (!query.filters.eventType || row.eventType === query.filters.eventType));
  return { contractVersion: 2, generatedAt: query.snapshotAt, cashSnapshot: "1:1:", outstandingRevision: "d41d8cd98f00b204e9800998ecf8427e", period: query.period, filters: query.filters,
    summary: { collectedAmount, refundAmount, netAmount: collectedAmount - refundAmount, discountAmount: rows.reduce((sum, row) => sum + row.discountAmount, 0), paidCount: new Set(rows.filter(row => row.eventType === "payment").map(row => row.entryId)).size, eventCount: rows.length },
    previous: { collectedAmount: 0, refundAmount: 0, netAmount: 0, discountAmount: 0, paidCount: 0, eventCount: 0 },
    daily: [...new Set(rows.map(row => row.occurredAt.slice(0, 10)))].sort().map(date => ({ date, collectedAmount: rows.filter(row => row.occurredAt.startsWith(date)).reduce((sum, row) => sum + Math.max(row.amount, 0), 0), refundAmount: rows.filter(row => row.occurredAt.startsWith(date)).reduce((sum, row) => sum + Math.max(-row.amount, 0), 0), netAmount: rows.filter(row => row.occurredAt.startsWith(date)).reduce((sum, row) => sum + row.amount, 0) })),
    categories: group(row => row.title), staff: group(row => row.staffName), paymentMethods: group(row => row.paymentMethod), benefits: rows.some(row => row.discountAmount>0) ? [{ name: "첫 방문 할인", usageCount: 1, discountAmount: 5000, freeServiceCount: 0 }] : [], staffOptions: [{ id: "demo-staff", name: "데모 원장" }],
    outstanding: { amount: 50000, count: 1, reviewRequiredCount: 1, through: query.period.to }, transactions: details.slice((query.page - 1) * 25, query.page * 25), pagination: { page: query.page, pageSize: 25, total: details.length, view: query.view } };
}
