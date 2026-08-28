import type { OwnerSupportRequestItem } from "@/components/admin/admin-dashboard-model";
import type { StatusIndicatorTone } from "@/components/owner-web/status-indicators";
import type { MarketingAgentStatus } from "@/types/marketing-agent";

export type AdminKanbanColumn = "action" | "review" | "complete";
export type AdminKanbanItem = { id: string; title: string; meta: string; column: AdminKanbanColumn; tone: StatusIndicatorTone };

export function buildAdminKanbanItems(requests: OwnerSupportRequestItem[], marketing: MarketingAgentStatus | null): AdminKanbanItem[] {
  const items: AdminKanbanItem[] = requests.map((request) => ({
    id: `support:${request.id}`,
    title: request.title,
    meta: request.shopName ?? request.shopId,
    column: request.status === "open" ? "action" : request.status === "reviewing" ? "review" : "complete",
    tone: request.status === "open" ? "amber" : request.status === "reviewing" ? "active" : "confirmed",
  }));
  const work = marketing?.workflow.currentWork;
  if (work) {
    const column: AdminKanbanColumn = work.status === "success" ? "complete" : work.status === "running" || work.status === "unknown" ? "review" : "action";
    const tone: StatusIndicatorTone = work.status === "success" ? "confirmed" : work.status === "running" ? "active" : work.status === "failed" ? "burgundy" : work.status === "suspended" ? "amber" : "neutral";
    items.push({ id: `work:${work.workItemId}`, title: work.goal, meta: marketing?.workflow.label ?? "마케팅 업무", column, tone });
  }
  if (marketing) {
    items.push({ id: "marketing:connection", title: "마케팅 워룸 연결", meta: marketing.studio.connected ? "연결 완료" : "연결 확인 필요", column: marketing.studio.connected ? "complete" : "action", tone: marketing.studio.connected ? "confirmed" : "amber" });
    if (marketing.workflow.pendingApprovals > 0) items.push({ id: "marketing:approvals", title: `승인 대기 ${marketing.workflow.pendingApprovals}건`, meta: "대표 검수 필요", column: "review", tone: "active" });
  }
  return items;
}
