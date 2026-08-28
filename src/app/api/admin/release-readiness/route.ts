import { NextRequest, NextResponse } from "next/server";

import { getReleaseReadinessSummary, RELEASE_READINESS_ITEMS } from "@/lib/admin-release-readiness";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const url = new URL(request.url);
    if (url.searchParams.get("view") !== "details") {
      return NextResponse.json(getReleaseReadinessSummary());
    }

    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 5), 1), 10);
    return NextResponse.json({
      items: RELEASE_READINESS_ITEMS.slice(offset, offset + limit),
      nextOffset: offset + limit < RELEASE_READINESS_ITEMS.length ? offset + limit : null,
      total: RELEASE_READINESS_ITEMS.length,
      version: getReleaseReadinessSummary().version,
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "출시 준비 상태를 확인하지 못해 운영 반영을 차단합니다." }, { status: 500 });
  }
}
