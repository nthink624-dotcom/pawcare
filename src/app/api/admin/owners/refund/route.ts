import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { refundOwnerLatestPayment } from "@/server/owner-billing";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

const bodySchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
  reason: z.string().trim().min(1).max(120),
});

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = bodySchema.parse(await request.json());
    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new AdminApiError("Supabase 관리자 설정을 확인해 주세요.", 503);
    }

    const userResult = await admin.auth.admin.getUserById(body.userId);
    const user = userResult.data.user;
    if (userResult.error || !user) {
      throw new AdminApiError("환불할 오너 계정을 찾지 못했습니다.", 404);
    }

    const result = await refundOwnerLatestPayment(user, body.shopId, body.reason);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "환불 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "결제 취소를 처리하지 못했습니다." }, { status: 500 });
  }
}
