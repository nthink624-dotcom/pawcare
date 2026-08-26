import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { decideMarketingApproval, getMarketingWarRoom } from "@/server/marketing-war-room";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const decisionSchema = z.object({
  gateId: z.enum(["SOURCING_APPROVAL", "TARGET_LIST_APPROVAL", "OUTREACH_APPROVAL"]),
  decision: z.enum(["approve", "revise", "hold", "reject"]),
});

export async function GET(request: NextRequest) {
  try {
    const account = await requireAdminSession(request);
    return NextResponse.json(getMarketingWarRoom(account.isSuperAdmin));
  } catch (error) {
    return handleError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const account = await requireAdminSession(request);
    if (!account.isSuperAdmin) throw new AdminApiError("대표 권한이 필요합니다.", 403);
    const parsed = decisionSchema.safeParse(await request.json());
    if (!parsed.success) throw new AdminApiError("승인 결정 형식을 확인해 주세요.", 400);
    return NextResponse.json(decideMarketingApproval({ representative: true, ...parsed.data }));
  } catch (error) {
    return handleError(error);
  }
}

function handleError(error: unknown) {
  if (error instanceof AdminApiError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof Error && error.message === "APPROVAL_NOT_ALLOWED") {
    return NextResponse.json({ message: "현재 상태에서는 이 승인을 처리할 수 없습니다." }, { status: 409 });
  }
  return NextResponse.json({ message: "마케팅 워룸 요청을 처리하지 못했습니다." }, { status: 500 });
}
