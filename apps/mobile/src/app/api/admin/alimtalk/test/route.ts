import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { sendAdminAlimtalkTest, type AdminAlimtalkTestInput } from "@/server/admin-alimtalk";

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = (await request.json()) as AdminAlimtalkTestInput;
    const result = await sendAdminAlimtalkTest(body);
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "관리자 테스트 발송에 실패했습니다.";
    return NextResponse.json({ message }, { status });
  }
}
