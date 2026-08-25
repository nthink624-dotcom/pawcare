import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getMarketingKpiSnapshot } from "@/server/marketing-kpi-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store",
};

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const days = parseDays(request.nextUrl.searchParams.get("days"));
    return NextResponse.json(await getMarketingKpiSnapshot(days), {
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json(
      { message: "마케팅 운영 KPI를 확인하지 못했습니다." },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}

function parseDays(value: string | null) {
  if (value === null) return 7;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > 30) {
    throw new AdminApiError("KPI 조회 기간은 1일부터 30일까지 지정할 수 있습니다.", 400);
  }
  return days;
}
