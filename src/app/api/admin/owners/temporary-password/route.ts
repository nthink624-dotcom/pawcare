import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export const runtime = "nodejs";

const temporaryPasswordSchema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().min(1),
});

function generateTemporaryPassword() {
  return `Pm1!${randomBytes(9).toString("base64url")}`;
}

function isIgnorableAdminEventError(error: { code?: string | null } | null | undefined) {
  return error?.code === "42P01" || error?.code === "23514";
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession(request);
    const body = temporaryPasswordSchema.parse(await request.json());
    const admin = getSupabaseAdmin();

    if (!admin) {
      throw new AdminApiError("Supabase 관리자 설정을 확인해 주세요.", 503);
    }

    const [profileResult, shopResult, userResult] = await Promise.all([
      admin
        .from("owner_profiles")
        .select("user_id, shop_id, login_id, name")
        .eq("user_id", body.userId)
        .eq("shop_id", body.shopId)
        .maybeSingle<{ user_id: string; shop_id: string; login_id: string | null; name: string | null }>(),
      admin
        .from("shops")
        .select("id, owner_user_id, name")
        .eq("id", body.shopId)
        .eq("owner_user_id", body.userId)
        .maybeSingle<{ id: string; owner_user_id: string | null; name: string | null }>(),
      admin.auth.admin.getUserById(body.userId),
    ]);

    if (profileResult.error) {
      throw new AdminApiError(profileResult.error.message, 500);
    }
    if (shopResult.error) {
      throw new AdminApiError(shopResult.error.message, 500);
    }
    if (userResult.error || !userResult.data.user || !profileResult.data || !shopResult.data) {
      throw new AdminApiError("임시비밀번호를 발급할 오너 계정을 찾지 못했습니다.", 404);
    }
    if (!profileResult.data.login_id) {
      throw new AdminApiError("로그인 아이디가 없는 계정에는 임시비밀번호를 발급할 수 없습니다.", 400);
    }

    const issuedAt = nowIso();
    const temporaryPassword = generateTemporaryPassword();
    const user = userResult.data.user;

    const updateResult = await admin.auth.admin.updateUserById(body.userId, {
      password: temporaryPassword,
      user_metadata: {
        ...(user.user_metadata ?? {}),
        password_reset_required: true,
        temporary_password_issued_at: issuedAt,
        temporary_password_issued_by: adminSession.email.toLowerCase().trim() || adminSession.loginId,
      },
    });

    if (updateResult.error) {
      throw new AdminApiError(updateResult.error.message || "임시비밀번호를 발급하지 못했습니다.", 400);
    }

    const eventResult = await admin.from("owner_admin_events").insert({
      target_user_id: body.userId,
      target_shop_id: body.shopId,
      admin_email: adminSession.email.toLowerCase().trim() || "unknown-admin",
      event_type: "temporary_password_issued",
      previous_payload: {},
      next_payload: {
        loginId: profileResult.data.login_id,
        issuedAt,
        passwordResetRequired: true,
      },
      note: "관리자가 오너 계정 임시비밀번호를 발급했습니다.",
    });

    if (eventResult.error && !isIgnorableAdminEventError(eventResult.error)) {
      throw new AdminApiError(eventResult.error.message, 500);
    }

    return NextResponse.json({
      success: true,
      loginId: profileResult.data.login_id,
      temporaryPassword,
      issuedAt,
      message: "임시비밀번호가 발급되었습니다. 기존 비밀번호는 더 이상 사용할 수 없습니다.",
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "오너 계정 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "임시비밀번호 발급 중 문제가 발생했습니다." }, { status: 500 });
  }
}
