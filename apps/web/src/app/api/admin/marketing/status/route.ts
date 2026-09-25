import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getMarketingAgentStatus } from "@/server/marketing-agent-status";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    return NextResponse.json(await getMarketingAgentStatus());
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: "마케팅 워룸 상태를 확인하지 못했습니다." },
      { status: 500 },
    );
  }
}
