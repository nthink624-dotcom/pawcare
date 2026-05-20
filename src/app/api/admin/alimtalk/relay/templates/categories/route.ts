import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getRelayTemplateCategories } from "@/server/admin-alimtalk";

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const result = await getRelayTemplateCategories();
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "쏘다 템플릿 카테고리 조회에 실패했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
