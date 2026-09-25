import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export async function GET(request: NextRequest) {
  try {
    const account = await requireAdminSession(request);
    return NextResponse.json(account);
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "관리자 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}
