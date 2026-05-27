import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { normalizeOwnerLoginId } from "@/lib/auth/owner-credentials";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

const storageHealthSchema = z.object({
  loginId: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(80),
  usage: z.number().finite().nonnegative().nullable().optional(),
  quota: z.number().finite().positive().nullable().optional(),
  usageRatio: z.number().finite().nonnegative().nullable().optional(),
});

type OwnerProfileForStorageHealth = {
  user_id: string;
  shop_id: string | null;
  login_id: string | null;
};

function isIgnorableAdminEventError(error: { code?: string | null } | null | undefined) {
  return error?.code === "42P01" || error?.code === "23514";
}

export async function POST(request: NextRequest) {
  try {
    const body = storageHealthSchema.parse(await request.json());
    const loginId = normalizeOwnerLoginId(body.loginId);
    const admin = getSupabaseAdmin();

    if (!admin || !loginId) {
      return NextResponse.json({ success: true });
    }

    const profileResult = await admin
      .from("owner_profiles")
      .select("user_id, shop_id, login_id")
      .eq("login_id", loginId)
      .maybeSingle<OwnerProfileForStorageHealth>();

    if (profileResult.error || !profileResult.data?.user_id) {
      return NextResponse.json({ success: true });
    }

    const usagePercent = body.usageRatio != null ? Math.round(body.usageRatio * 1000) / 10 : null;
    const eventResult = await admin.from("owner_admin_events").insert({
      target_user_id: profileResult.data.user_id,
      target_shop_id: profileResult.data.shop_id,
      admin_email: "system",
      event_type: "status_changed",
      previous_payload: {},
      next_payload: {
        systemAlertType: "browser_storage_pressure",
        loginId,
        reason: body.reason,
        usage: body.usage ?? null,
        quota: body.quota ?? null,
        usageRatio: body.usageRatio ?? null,
        usagePercent,
        userAgent: request.headers.get("user-agent") ?? null,
      },
      note:
        usagePercent != null
          ? `브라우저 저장소 사용량이 ${usagePercent}%로 감지되었습니다. 로그인 저장 장애를 막기 위해 점검이 필요합니다.`
          : "브라우저 저장소 쓰기 실패가 감지되었습니다. 로그인 저장 장애를 막기 위해 점검이 필요합니다.",
    });

    if (eventResult.error && !isIgnorableAdminEventError(eventResult.error)) {
      console.error("[auth/storage-health] failed to record admin event", eventResult.error);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error("[auth/storage-health] unexpected error", error);
    }
    return NextResponse.json({ success: true });
  }
}
