import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { getSignupFlowReviewManifest } from "@/server/signup-flow-review";

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") return NextResponse.json({ error: "개발 전용" }, { status: 404 });
  try {
    await requireAdminSession(request);
    return NextResponse.json(await getSignupFlowReviewManifest(), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "권한 없음" },
      { status: error instanceof AdminApiError ? error.status : 500 },
    );
  }
}
