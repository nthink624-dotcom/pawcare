import { NextRequest, NextResponse } from "next/server";

import { CONTROL_PLANE_FIXTURE_EVENTS, projectControlPlaneEvents } from "@/lib/agent-control-plane";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const cursor = Math.max(0, Math.min(Number(request.nextUrl.searchParams.get("cursor") ?? 0) || 0, CONTROL_PLANE_FIXTURE_EVENTS.length));
    const visibleCount = cursor === 0 ? 1 : Math.min(cursor + 1, CONTROL_PLANE_FIXTURE_EVENTS.length);
    const snapshot = projectControlPlaneEvents({
      events: CONTROL_PLANE_FIXTURE_EVENTS.slice(0, visibleCount),
      now: CONTROL_PLANE_FIXTURE_EVENTS[Math.max(0, visibleCount - 1)].receivedAt,
      cursor: visibleCount,
      hasMore: visibleCount < CONTROL_PLANE_FIXTURE_EVENTS.length,
    });
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AdminApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "관제 Preview를 불러오지 못했습니다.", executionEnabled: false, externalExecution: false }, { status: 500 });
  }
}
