import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getRelayTemplateCatalog } from "@/server/admin-alimtalk";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const result = await getRelayTemplateCatalog();
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 relay 템플릿 정보를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
