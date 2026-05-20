import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { checkRelayTemplateCode } from "@/server/admin-alimtalk";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = (await request.json()) as Parameters<typeof checkRelayTemplateCode>[0];
    const result = await checkRelayTemplateCode(body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "쏘다 템플릿 코드 검증에 실패했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
