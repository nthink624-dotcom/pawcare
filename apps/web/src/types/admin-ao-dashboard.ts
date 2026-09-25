import type { AdminWorkEvidenceSource } from "@/components/admin/admin-kanban";

export type AdminAoLaneId = "queued" | "working" | "action" | "review" | "completed";
export type AdminAoCard = { key: string; title: string; assignee: string; statusLabel: string; nextAction: string; source: AdminWorkEvidenceSource; sourceLabel: string; updatedAt: string | null; approvalRequired: boolean };
export type AdminAoLane = { id: AdminAoLaneId; title: "지시사항" | "작업중" | "조치필요" | "검수필요" | "완료"; cards: AdminAoCard[] };
export type AdminAoDashboardSnapshot = { checkedAt: string; connection: "connected" | "limited" | "unavailable"; connectionLabel: "연결됨" | "일부 연결" | "연결 전"; lanes: AdminAoLane[] };
export type AdminAoCardDetail = AdminAoCard & { directiveSummary: string; planSummary: string; blocker: string; approval: string; completed: string };
