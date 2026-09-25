import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { resetOwnerPaymentMethod } from "@/server/owner-billing";

const bodySchema = z.object({
  userId: z.string().min(1),
  shopId: z.string().min(1),
  reason: z.string().trim().min(1).max(120).optional(),
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
      throw new AdminApiError("대상 오너 계정을 찾지 못했습니다.", 404);
    }

    await resetOwnerPaymentMethod(
      {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        user_metadata: user.user_metadata ?? null,
      },
      body.shopId,
      body.reason?.trim() || "관리자 결제수단 초기화",
    );

    return NextResponse.json({
      success: true,
      message: "등록된 결제수단을 초기화했습니다. 이제 오너가 새 카드를 다시 등록할 수 있어요.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "결제수단 초기화 요청 형식이 올바르지 않습니다." }, { status: 400 });
    }

    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "결제수단을 초기화하지 못했습니다." }, { status: 500 });
  }
}
