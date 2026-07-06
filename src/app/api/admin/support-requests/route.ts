import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import {
  listOwnerSupportRequests,
  OwnerSupportRequestError,
  updateOwnerSupportRequest,
} from "@/server/owner-support-requests";

const updateSupportRequestSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "reviewing", "resolved", "closed"]),
  adminNote: z.string().max(3000).optional().default(""),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);
    const requests = await listOwnerSupportRequests(limit);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof AdminApiError || error instanceof OwnerSupportRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "오너 문의를 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = updateSupportRequestSchema.parse(await request.json());
    const supportRequest = await updateOwnerSupportRequest(body);
    return NextResponse.json({ request: supportRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "처리 상태를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof AdminApiError || error instanceof OwnerSupportRequestError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "오너 문의를 저장하지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
