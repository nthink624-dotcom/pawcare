import { NextRequest, NextResponse } from "next/server";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

const MAX_LIMIT = 100;
const auditSelect = [
  "id",
  "shop_id",
  "actor_label",
  "action_source",
  "action_type",
  "entity_type",
  "entity_id",
  "request_id",
  "created_at",
].join(",");

function getAdmin() {
  const admin = getSupabaseAdmin();
  if (!admin) throw new AdminApiError("관리자 데이터 연결을 확인하지 못했습니다.", 503);
  return admin;
}

function safeEvent(item: Record<string, unknown>) {
  return {
    id: typeof item.id === "string" ? item.id : null,
    shopId: typeof item.shop_id === "string" ? item.shop_id : null,
    actorLabel: typeof item.actor_label === "string" ? item.actor_label : null,
    actionSource: typeof item.action_source === "string" ? item.action_source : null,
    actionType: typeof item.action_type === "string" ? item.action_type : null,
    entityType: typeof item.entity_type === "string" ? item.entity_type : null,
    entityId: typeof item.entity_id === "string" ? item.entity_id : null,
    requestId: typeof item.request_id === "string" ? item.request_id : null,
    createdAt: typeof item.created_at === "string" ? item.created_at : null,
  };
}

function parseLimit(value: string | null) {
  if (!value) return MAX_LIMIT;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AdminApiError("조회 개수는 1 이상이어야 합니다.", 400);
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseSince(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new AdminApiError("조회 시작 시간이 올바르지 않습니다.", 400);
  }
  return date.toISOString();
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getAdmin();
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() || null;
    const actionSource = request.nextUrl.searchParams.get("actionSource")?.trim() || null;
    const actionType = request.nextUrl.searchParams.get("actionType")?.trim() || null;
    const entityType = request.nextUrl.searchParams.get("entityType")?.trim() || null;
    const since = parseSince(request.nextUrl.searchParams.get("since"));
    const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

    let query = admin
      .from("owner_activity_events")
      .select(auditSelect)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (shopId) query = query.eq("shop_id", shopId);
    if (actionSource) query = query.eq("action_source", actionSource);
    if (actionType) query = query.eq("action_type", actionType);
    if (entityType) query = query.eq("entity_type", entityType);
    if (since) query = query.gte("created_at", since);

    const result = await query;
    if (result.error) throw new AdminApiError("감사 로그를 불러오지 못했습니다.", 503);
    return NextResponse.json({ ok: true, events: (result.data ?? []).map((item) => safeEvent(item as unknown as Record<string, unknown>)) });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof AdminApiError ? error.message : "감사 로그를 불러오지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
