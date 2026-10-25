import { timingSafeEqual } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const safeText = z.string().trim().min(1).max(500).refine((value) => !containsForbiddenIdentifier(value), "비식별 요약만 허용됩니다.");
const eventSchema = z.object({
  idempotencyKey: z.string().min(16).max(160).regex(/^[A-Za-z0-9._:-]+$/),
  workId: z.string().min(3).max(80).regex(/^[A-Z0-9-]+$/),
  title: safeText.max(120),
  ownerTeam: safeText.max(60),
  parentWorkId: z.string().min(3).max(80).regex(/^[A-Z0-9-]+$/).nullable(),
  roleLabel: safeText.max(40),
  status: z.enum(["not_started", "in_progress", "blocked", "review", "approval_waiting", "approved", "rejected", "completed"]),
  currentStage: safeText.max(100),
  completedSummary: safeText.nullable(),
  blockerSummary: safeText.nullable(),
  nextAction: safeText.nullable(),
  sourceSystem: z.enum(["growth", "analysis", "codex", "mastra", "operations"]),
  sourceType: z.literal("operational"),
  sourceSequence: z.number().int().nonnegative(),
  eventType: z.enum(["directive_created", "directive_received", "status_changed", "artifact_ready", "review_requested", "approval_waiting", "completed", "archived", "restored"]),
  syncState: z.enum(["connected", "sync_limited", "source_unavailable"]),
  originalDirectiveSummary: safeText,
  operationsDirectiveSummary: safeText,
  approvalRequired: z.boolean(),
  sourceEventAt: z.string().datetime({ offset: true }),
});

export async function POST(request: NextRequest) {
  if (!hasValidServerToken(request.headers.get("authorization"))) {
    return NextResponse.json({ message: "서버 인증이 필요합니다.", externalExecution: false }, { status: 403 });
  }

  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ message: "안전한 상태 이벤트 형식을 확인해 주세요.", externalExecution: false }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ message: "상태 원장 미연결", externalExecution: false }, { status: 503 });
  const value = parsed.data;
  const { data, error } = await admin.rpc("ingest_marketing_work_event", {
    p_idempotency_key: value.idempotencyKey,
    p_work_id: value.workId,
    p_title: value.title,
    p_owner_team: value.ownerTeam,
    p_parent_work_id: value.parentWorkId,
    p_role_label: value.roleLabel,
    p_status: value.status,
    p_current_stage: value.currentStage,
    p_completed_summary: value.completedSummary,
    p_blocker_summary: value.blockerSummary,
    p_next_action: value.nextAction,
    p_source_system: value.sourceSystem,
    p_source_sequence: value.sourceSequence,
    p_event_type: value.eventType,
    p_sync_state: value.syncState,
    p_original_directive_summary: value.originalDirectiveSummary,
    p_operations_directive_summary: value.operationsDirectiveSummary,
    p_approval_required: value.approvalRequired,
    p_source_event_at: value.sourceEventAt,
  });
  if (error) return NextResponse.json({ message: "상태 원장 저장 실패", externalExecution: false }, { status: 503 });
  return NextResponse.json({ accepted: true, eventId: data, executionEnabled: false, externalExecution: false });
}

function hasValidServerToken(authorization: string | null) {
  const expected = process.env.MARKETING_WORK_EVENT_TOKEN?.trim();
  const received = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!expected || !received || expected.length !== received.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(received));
}

function containsForbiddenIdentifier(value: string) {
  return /(?:https?:\/\/|[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|01[016789][- ]?\d{3,4}[- ]?\d{4}|(?:user|shop|contact|payment|appointment|batch)[_-]?id)/i.test(value);
}
