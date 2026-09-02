import type { StatusIndicatorTone } from "@/components/owner-web/status-indicators";

export type AdminWorkStage = "directive" | "in_progress" | "action_required" | "review_required" | "complete";
export type AdminWorkEvidenceSource = "codex_live" | "local_snapshot" | "manual" | "fixture" | "unavailable";
export type AdminWorkItemInput = { id: string; title: string; directiveSummary: string; breakdown: string[]; owner: string; stage: AdminWorkStage; actualStatus: string; blocker: string | null; nextAction: string; ownerDecision: string | null; checkedAt: string; source: AdminWorkEvidenceSource; sourceLabel: string; completionCriteria: string[]; verificationResults: string[] };
export type AdminWorkCard = AdminWorkItemInput & { stageLabel: string; tone: StatusIndicatorTone };

const STAGE_PRESENTATION: Record<AdminWorkStage, { label: string; tone: StatusIndicatorTone }> = {
  directive: { label: "지시사항", tone: "neutral" }, in_progress: { label: "작업중", tone: "active" }, action_required: { label: "조치필요", tone: "amber" }, review_required: { label: "검수필요", tone: "active" }, complete: { label: "완료", tone: "confirmed" },
};
export const ADMIN_WORK_STAGES = (Object.entries(STAGE_PRESENTATION) as Array<[AdminWorkStage, { label: string; tone: StatusIndicatorTone }]>).map(([id, presentation]) => ({ id, ...presentation }));

/** 실제 업무 원장 응답을 UI 계약으로 바꾸는 단일 경계다. 연결 전에는 null이며 합성 업무를 만들지 않는다. */
export function adaptAdminWorkItems(items: AdminWorkItemInput[] | null): AdminWorkCard[] {
  if (!items) return [];
  return items.map((item) => ({ ...item, stageLabel: STAGE_PRESENTATION[item.stage].label, tone: STAGE_PRESENTATION[item.stage].tone }));
}
