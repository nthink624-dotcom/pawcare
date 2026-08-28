import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getAdminAoCardDetail } from "@/server/admin-ao-dashboard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, context: { params: Promise<{ key: string }> }) {
  try {
    await requireAdminSession(request);
    const { key } = await context.params;
    if (!/^[a-f0-9]{16}$/.test(key)) return NextResponse.json({ message: "업무를 찾을 수 없습니다." }, { status: 404 });
    const detail = await getAdminAoCardDetail(key);
    if (!detail) return NextResponse.json({ message: "업무 상세를 확인할 수 없습니다." }, { status: 404 });
    return NextResponse.json(detail, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof AdminApiError ? error.message : "업무 상세를 확인하지 못했습니다.";
    return NextResponse.json({ message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
