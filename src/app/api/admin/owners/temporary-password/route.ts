import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { assertAdminHighRiskActionReady } from "@/server/admin-high-risk-actions";

export async function POST(request: NextRequest) {
  try {
    const account = await requireAdminSession(request);
    assertAdminHighRiskActionReady("credential_reset", account);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "계정 복구 보안 절차를 확인하지 못했습니다." }, { status: 503 });
  }
}
