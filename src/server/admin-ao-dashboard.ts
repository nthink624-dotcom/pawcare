import { createHash } from "node:crypto";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AdminWorkEvidenceSource } from "@/components/admin/admin-kanban";
import type { AdminAoCard, AdminAoCardDetail, AdminAoDashboardSnapshot, AdminAoLane, AdminAoLaneId } from "@/types/admin-ao-dashboard";

type RawWorkItem = { work_id?: unknown; title?: unknown; role_label?: unknown; status?: unknown; original_directive_summary?: unknown; operations_directive_summary?: unknown; completed_summary?: unknown; blocker_summary?: unknown; next_action?: unknown; approval_required?: unknown; source_system?: unknown; source_updated_at?: unknown; sync_state?: unknown; updated_at?: unknown };
const lanes: Array<Pick<AdminAoLane, "id" | "title">> = [{ id: "queued", title: "지시사항" }, { id: "working", title: "작업중" }, { id: "action", title: "조치필요" }, { id: "review", title: "검수필요" }, { id: "completed", title: "완료" }];
const unsafeTextPatterns = [/[A-Z]:\\|(?:^|\s)\/[\w.-]+\//, /(?:https?:\/\/|www\.)/i, /\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/, /\b01[016789][ -]?\d{3,4}[ -]?\d{4}\b/, /(?:<analysis>|원문 대화|chain.of.thought|명령 출력)/i];
const selection = "work_id,title,role_label,status,original_directive_summary,operations_directive_summary,completed_summary,blocker_summary,next_action,approval_required,source_system,source_updated_at,sync_state,updated_at";

export function mapAdminAoLane(status: unknown): AdminAoLaneId {
  if (status === "in_progress" || status === "running") return "working";
  if (["blocked", "failed", "rejected", "approval_waiting"].includes(String(status))) return "action";
  if (status === "review") return "review";
  if (status === "completed" || status === "approved") return "completed";
  return "queued";
}

export function buildAdminAoDashboardSnapshot(input: { items: RawWorkItem[]; checkedAt: string; sourceAvailable: boolean }): AdminAoDashboardSnapshot {
  const projected = input.items.map((item) => ({ item, lane: mapAdminAoLane(item.status), card: toCard(item) })).sort((a, b) => timestamp(b.item) - timestamp(a.item));
  const connection = !input.sourceAvailable ? "unavailable" : input.items.some((item) => item.sync_state === "source_unavailable") ? "limited" : "connected";
  return { checkedAt: input.checkedAt, connection, connectionLabel: connection === "connected" ? "연결됨" : connection === "limited" ? "일부 연결" : "연결 전", lanes: lanes.map((lane) => ({ ...lane, cards: projected.filter((entry) => entry.lane === lane.id).map((entry) => entry.card) })) };
}

export function buildAdminAoCardDetail(item: RawWorkItem): AdminAoCardDetail {
  return { ...toCard(item), directiveSummary: safeText(item.original_directive_summary, "기록 없음"), planSummary: safeText(item.operations_directive_summary, "기록 없음"), blocker: safeText(item.blocker_summary, "없음"), approval: item.approval_required === true ? "대표 판단 필요" : "대표 판단 불필요", completed: safeText(item.completed_summary, "기록 없음") };
}

export async function getAdminAoDashboard() {
  const admin = getSupabaseAdmin(); const checkedAt = new Date().toISOString();
  if (!admin) return buildAdminAoDashboardSnapshot({ items: [], checkedAt, sourceAvailable: false });
  const { data, error } = await admin.from("marketing_work_items").select(selection).eq("source_type", "operational").is("archived_at", null).order("updated_at", { ascending: false }).limit(100);
  return buildAdminAoDashboardSnapshot({ items: error ? [] : data ?? [], checkedAt, sourceAvailable: !error });
}

export async function getAdminAoCardDetail(key: string) {
  const admin = getSupabaseAdmin(); if (!admin) return null;
  const { data, error } = await admin.from("marketing_work_items").select(selection).eq("source_type", "operational").is("archived_at", null).limit(100);
  if (error) return null;
  const item = (data ?? []).find((candidate) => cardKey(candidate.work_id) === key);
  return item ? buildAdminAoCardDetail(item) : null;
}

function toCard(item: RawWorkItem): AdminAoCard { const status = String(item.status ?? "not_started"); const source = sourceType(item); return { key: cardKey(item.work_id), title: safeText(item.title, "제목 확인 불가"), assignee: safeAssignee(item.role_label), statusLabel: statusText(status), nextAction: safeText(item.next_action, "기록 없음"), source, sourceLabel: sourceLabel(source), updatedAt: safeDate(item.source_updated_at ?? item.updated_at), approvalRequired: item.approval_required === true }; }
function cardKey(value: unknown) { return createHash("sha256").update(String(value ?? "unassigned")).digest("hex").slice(0, 16); }
function safeText(value: unknown, fallback: string) { if (typeof value !== "string") return fallback; const text = value.replace(/\s+/g, " ").trim(); return !text || text.length > 240 || unsafeTextPatterns.some((pattern) => pattern.test(text)) ? fallback : text; }
function safeAssignee(value: unknown) { return typeof value === "string" && ["운영팀", "성장팀", "디자인팀", "분석팀", "구현팀"].includes(value) ? value : "미배정"; }
function sourceType(item: RawWorkItem): AdminWorkEvidenceSource { if (item.sync_state === "source_unavailable") return "unavailable"; if (item.source_system === "codex" && item.sync_state === "connected") return "codex_live"; if (item.source_system === "operations") return "manual"; if (item.source_system === "mastra") return "local_snapshot"; return "unavailable"; }
function sourceLabel(source: AdminWorkEvidenceSource) { return source === "codex_live" ? "Codex 연결" : source === "manual" ? "운영 원장" : source === "local_snapshot" ? "연결 스냅샷" : "출처 확인 불가"; }
function statusText(status: string) { if (status === "approval_waiting") return "승인 대기"; if (["blocked", "failed", "rejected"].includes(status)) return "막힘"; return lanes.find((item) => item.id === mapAdminAoLane(status))?.title ?? "확인 불가"; }
function safeDate(value: unknown) { return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null; }
function timestamp(item: RawWorkItem) { return Date.parse(String(item.source_updated_at ?? item.updated_at ?? "")) || 0; }
