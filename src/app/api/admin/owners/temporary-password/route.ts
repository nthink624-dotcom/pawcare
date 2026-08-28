import { NextRequest, NextResponse } from "next/server";

import { AdminApiError, requireSuperAdminSession } from "@/server/admin-api-auth";

export async function POST(request: NextRequest) {
  try {
    await requireSuperAdminSession(request);

    // Supabase Auth와 public 감사 테이블은 하나의 PostgreSQL 트랜잭션으로
    // 원자화할 수 없다. 감사 기록 없는 자격증명 변경을 허용하지 않는다.
    throw new AdminApiError(
      "임시비밀번호 발급은 원자적 감사 절차가 준비될 때까지 차단됩니다.",
      503,
    );
  } catch (error) {
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { message: "계정 복구 보안 절차를 확인하지 못했습니다." },
      { status: 503 },
    );
  }
}
