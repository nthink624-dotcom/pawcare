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
  status: z.enum(["open", "reviewing", "answered", "resolved", "closed"]),
  adminNote: z.string().max(3000).optional().default(""),
  answerMessage: z.string().max(5000).optional().default(""),
});

function knownSupportErrorResponse(error: AdminApiError | OwnerSupportRequestError, fallback: string) {
  if (error.status >= 500) {
    return NextResponse.json({ message: fallback }, { status: 503 });
  }

  return NextResponse.json({ message: error.message }, { status: error.status });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 30), 1), 100);
    const requests = await listOwnerSupportRequests(limit);
    return NextResponse.json({ requests });
  } catch (error) {
    if (error instanceof AdminApiError || error instanceof OwnerSupportRequestError) {
      return knownSupportErrorResponse(
        error,
        "고객 문의를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    return NextResponse.json(
      { message: "고객 문의를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const admin = await requireAdminSession(request);
    const body = updateSupportRequestSchema.parse(await request.json());
    const supportRequest = await updateOwnerSupportRequest({
      ...body,
      adminId: admin.id,
      adminName: admin.fullName,
    });
    return NextResponse.json({ request: supportRequest });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "처리 상태를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof AdminApiError || error instanceof OwnerSupportRequestError) {
      return knownSupportErrorResponse(
        error,
        "문의 처리 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }

    return NextResponse.json(
      { message: "문의 처리 내용을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500 },
    );
  }
}
