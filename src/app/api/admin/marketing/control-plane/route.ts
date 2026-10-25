import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import type { ControlPlaneEvent, ControlPlaneSnapshot } from "@/types/agent-control-plane";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) return unavailable("상태 원장 미연결", 503);
    const [{ data: items, error: itemError }, { data: events, error: eventError }] = await Promise.all([
      admin.from("marketing_work_items").select("*").eq("source_type", "operational").is("archived_at", null).order("updated_at", { ascending: false }).limit(100),
      admin.from("marketing_work_events").select("*").eq("source_type", "operational").order("source_sequence", { ascending: false }).limit(200),
    ]);
    if (itemError || eventError) return unavailable("상태 원장 연결 실패", 503);
    const checkedAt = new Date().toISOString();
    const eventByWork = new Map((events ?? []).map((event) => [event.work_id, event]));
    const timeline: ControlPlaneEvent[] = (events ?? []).map((event) => {
      const item = (items ?? []).find((candidate) => candidate.work_id === event.work_id);
      return toEvent(event, item, checkedAt);
    }).reverse();
    const nodes = (items ?? []).map((item) => {
      const event = eventByWork.get(item.work_id);
      const projected = toEvent(event ?? { id: `projection-${item.work_id}`, source_sequence: 0, event_type: "status_changed", source_event_at: item.source_updated_at }, item, checkedAt);
      const freshness: "fresh" | "stale" | "source_unavailable" = item.sync_state === "source_unavailable" ? "source_unavailable" : Date.now() - Date.parse(item.source_updated_at) > 5 * 60_000 ? "stale" : "fresh";
      return { ...projected, lastEventId: projected.eventId, freshness };
    });
    const snapshot: ControlPlaneSnapshot = {
      mode: "operational",
      checkedAt,
      cursor: Math.max(0, ...timeline.map((event) => event.sequence)),
      hasMore: false,
      sources: { codex: nodes.some((node) => node.source === "codex" && node.freshness === "fresh") ? "connected" : "sync_limited", mastra: nodes.some((node) => node.source === "mastra" && node.freshness === "fresh") ? "connected" : "poc_only" },
      nodes,
      timeline,
      executionEnabled: false,
      externalExecution: false,
    };
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    if (error instanceof AdminApiError) return unavailable(error.message, error.status);
    return unavailable("업무 상태를 불러오지 못했습니다.", 500);
  }
}

// Supabase's generated project types do not yet include this pending migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toEvent(event: Record<string, any>, item: Record<string, any> | undefined, checkedAt: string): ControlPlaneEvent {
  return {
    eventId: String(event.id), sequence: Number(event.source_sequence ?? 0), workId: String(item?.work_id ?? event.work_id), parentWorkId: item?.parent_work_id ?? event.parent_work_id ?? null,
    source: item?.source_system ?? event.source_system ?? "operations", sourceThreadRef: item?.sync_state === "connected" ? "gateway" : null, role: item?.role_label ?? "운영팀",
    eventType: event.event_type ?? "status_changed", status: item?.status ?? event.status ?? "not_started", title: item?.title ?? "업무 상태",
    originalDirectiveSummary: item?.original_directive_summary ?? "비식별 원지시 요약", operationsDirectiveSummary: item?.operations_directive_summary ?? "비식별 운영 지시 요약",
    completedSummary: item?.completed_summary ?? null, blockerSummary: item?.blocker_summary ?? null, nextAction: item?.next_action ?? "상태 갱신 대기", approvalRequired: Boolean(item?.approval_required), artifact: null,
    sourceEventAt: event.source_event_at ?? item?.source_updated_at ?? checkedAt, receivedAt: event.created_at ?? item?.updated_at ?? checkedAt,
  };
}

function unavailable(message: string, status: number) {
  return NextResponse.json({ message, mode: "operational", executionEnabled: false, externalExecution: false }, { status, headers: { "Cache-Control": "private, no-store" } });
}
