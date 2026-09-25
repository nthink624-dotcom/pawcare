import { NextRequest, NextResponse } from "next/server";

import {
  DevelopmentTestOwnerError,
  assertDevelopmentTestOwnerRequest,
  ensureDevelopmentTestOwner,
  getDevelopmentTestOwnerStatus,
} from "@/server/dev-test-owner";

export const dynamic = "force-dynamic";

function safeErrorResponse(error: unknown) {
  if (error instanceof DevelopmentTestOwnerError) {
    return NextResponse.json(
      { ready: false, code: error.code, message: error.message },
      { status: error.status },
    );
  }

  console.error("[dev-test-owner] unexpected_failure");
  return NextResponse.json(
    { ready: false, code: "unexpected_failure", message: "검수용 테스트 오너를 준비하지 못했습니다." },
    { status: 500 },
  );
}

export async function GET(request: NextRequest) {
  try {
    assertDevelopmentTestOwnerRequest(request.nextUrl.hostname);
    const status = await getDevelopmentTestOwnerStatus();
    return NextResponse.json(status, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    assertDevelopmentTestOwnerRequest(request.nextUrl.hostname);
    const result = await ensureDevelopmentTestOwner();
    return NextResponse.json(
      {
        ready: result.ready,
        missing: result.missing,
        changed: result.changed,
        shopId: result.shopId,
        session: {
          accessToken: result.session.access_token,
          refreshToken: result.session.refresh_token,
        },
        message:
          result.changed.length > 0
            ? "검수용 테스트 오너의 빠진 연결만 보충하고 로그인했습니다."
            : "검수용 테스트 오너 상태를 그대로 확인하고 로그인했습니다.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}
