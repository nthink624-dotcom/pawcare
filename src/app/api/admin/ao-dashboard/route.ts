import { NextRequest, NextResponse } from "next/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getAdminAoDashboard } from "@/server/admin-ao-dashboard";
export const runtime = "nodejs"; export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) { try { await requireAdminSession(request); return NextResponse.json(await getAdminAoDashboard(), { headers: { "Cache-Control": "private, no-store" } }); } catch (error) { const status = error instanceof AdminApiError ? error.status : 500; return NextResponse.json({ message: error instanceof AdminApiError ? error.message : "업무 현황을 확인하지 못했습니다." }, { status, headers: { "Cache-Control": "private, no-store" } }); } }
