import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminAoCard, AdminAoCardDetail, AdminAoDashboardSnapshot, AdminAoLane, AdminAoLaneId } from "@/types/admin-ao-dashboard";

type RawWorkItem = {
  work_id?: unknown;
  title?: unknown;
  role_label?: unknown;
  status?: unknown;
  original_directive_summary?: unknown;
  operations_directive_summary?: unknown;
  completed_summary?: unknown;
  blocker_summary?: unknown;
  next_action?: unknown;
  approval_required?: unknown;
  source_system?: unknown;
  source_updated_at?: unknown;
  sync_state?: unknown;
  updated_at?: unknown;
};

const laneDefinitions: Array<Pick<AdminAoLane, "id" | "title">> = [
  { id: "queued", title: "지시사항" },
  { id: "working", title: "작업중" },
  { id: "action", title: "조치필요" },
  { id: "review", title: "검수필요" },
  { id: "completed", title: "완료" },
];

const unsafeTextPatterns = [
  /[A-Z]:\\|(?:^|\s)\/[\w.-]+\//,
  /(?:https?:\/\/|www\.)/i,
  /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/,
  /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/,
  /\b(?:git|npm|node|powershell|curl|select|insert|update|delete)\b/i,
  /(?:<analysis>|원문 대화|chain.of.thought|명령 출력)/i,
];

export function mapAdminAoLane(status: unknown): AdminAoLaneId {
  switch (status) {
    case "in_progress":
    case "running":
      return "working";
    case "blocked":
    case "failed":
    case "rejected":
    case "approval_waiting":
      return "action";
    case "review":
      return "review";
    case "completed":
    case "approved":
      return "completed";
    case "queued":
    case "received":
    case "not_started":
    default:
      return "queued";
  }
}

export function buildAdminAoDashboardSnapshot(input: { items: RawWorkItem[]; checkedAt: string; sourceAvailable: boolean }): AdminAoDashboardSnapshot {
  const projected = input.items
    .map((item) => ({ item, lane: mapAdminAoLane(item.status), card: toCard(item) }))
    .sort((left, right) => timestamp(right.item) - timestamp(left.item));
  const firstQueued = projected.find((entry) => entry.lane === "queued");
  if (firstQueued) {
    firstQueued.card.representativeDirective = safeText(firstQueued.item.original_directive_summary, "확인 불가");
  }

  const lanes = laneDefinitions.map((definition) => ({
    ...definition,
    cards: projected.filter((entry) => entry.lane === definition.id).map((entry) => entry.card),
  }));
  const connection = !input.sourceAvailable ? "unavailable" : input.items.some((item) => item.sync_state === "source_unavailable") ? "limited" : "connected";
  return {
    checkedAt: input.checkedAt,
    connection,
    connectionLabel: connection === "connected" ? "연결됨" : connection === "limited" ? "일부 연결" : "연결 전",
    lanes,
  };
}

export function buildAdminAoCardDetail(item: RawWorkItem): AdminAoCardDetail {
  const card = toCard(item);
  return {
    key: card.key,
    title: card.title,
    assignee: card.assignee,
    statusLabel: card.statusLabel,
    objective: safeText(item.operations_directive_summary, "확인 불가"),
    completed: safeText(item.completed_summary, "아직 기록 없음"),
    blocker: safeText(item.blocker_summary, "없음"),
    nextAction: card.nextAction,
    approval: item.approval_required === true ? "대표 승인 필요" : "승인 불필요",
    sourceLabel: card.sourceLabel,
    updatedAt: card.updatedAt,
  };
}

export async function getAdminAoDashboard() {
  const admin = getSupabaseAdmin();
  const checkedAt = new Date().toISOString();
  if (!admin) return buildAdminAoDashboardSnapshot({ items: [], checkedAt, sourceAvailable: false });
  const { data, error } = await admin
    .from("marketing_work_items")
    .select("work_id,title,role_label,status,original_directive_summary,operations_directive_summary,completed_summary,blocker_summary,next_action,approval_required,source_system,source_updated_at,sync_state,updated_at")
    .eq("source_type", "operational")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(100);
  return buildAdminAoDashboardSnapshot({ items: error ? [] : data ?? [], checkedAt, sourceAvailable: !error });
}

export async function getAdminAoCardDetail(key: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;
  const { data, error } = await admin
    .from("marketing_work_items")
    .select("work_id,title,role_label,status,original_directive_summary,operations_directive_summary,completed_summary,blocker_summary,next_action,approval_required,source_system,source_updated_at,sync_state,updated_at")
    .eq("source_type", "operational")
    .is("archived_at", null)
    .limit(100);
  if (error) return null;
  const item = (data ?? []).find((candidate) => cardKey(candidate.work_id) === key);
  return item ? buildAdminAoCardDetail(item) : null;
}

function toCard(item: RawWorkItem): AdminAoCard {
  const status = String(item.status ?? "not_started");
  return {
    key: cardKey(item.work_id),
    title: safeText(item.title, "제목 확인 불가"),
    assignee: safeAssignee(item.role_label),
    statusLabel: statusText(status),
    nextAction: safeText(item.next_action, "다음 단계 확인 불가"),
    sourceLabel: sourceText(item),
    updatedAt: safeDate(item.source_updated_at ?? item.updated_at),
    approvalRequired: item.approval_required === true,
  };
}

function cardKey(workId: unknown) {
  return createHash("sha256").update(String(workId ?? "unassigned")).digest("hex").slice(0, 16);
}

function safeText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized || normalized.length > 240 || unsafeTextPatterns.some((pattern) => pattern.test(normalized))) return fallback;
  return normalized;
}

function safeAssignee(value: unknown) {
  if (typeof value !== "string" || !["운영팀", "성장팀", "디자인팀", "분석팀", "구현팀"].includes(value)) return "미배정";
  return value;
}

function sourceText(item: RawWorkItem) {
  if (item.sync_state === "source_unavailable") return "연결 전";
  if (item.source_system === "codex") return "Codex 연결";
  if (item.source_system === "mastra") return "Mastra 연결";
  if (item.source_system === "operations") return "운영 원장";
  return "출처 확인 불가";
}

function statusText(status: string) {
  const lane = mapAdminAoLane(status);
  if (status === "approval_waiting") return "승인 대기";
  if (status === "blocked" || status === "failed" || status === "rejected") return "막힘";
  return laneDefinitions.find((item) => item.id === lane)?.title ?? "확인 불가";
}

function safeDate(value: unknown) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return value;
}

function timestamp(item: RawWorkItem) {
  return Date.parse(String(item.source_updated_at ?? item.updated_at ?? "")) || 0;
}
