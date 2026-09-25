import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getRelayAdminConfig, updateRelayAdminConfig } from "@/server/admin-alimtalk";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const result = await getRelayAdminConfig();
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 relay 설정을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = (await request.json()) as Parameters<typeof updateRelayAdminConfig>[0];
    const result = await updateRelayAdminConfig(body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 relay 설정 저장에 실패했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
