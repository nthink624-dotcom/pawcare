import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export const runtime = "nodejs";

const withdrawOwnerSchema = z.object({
  userId: z.string().uuid(),
  shopId: z.string().min(1),
  confirmation: z.string().min(1),
});

type OwnerProfileTarget = {
  user_id: string;
  shop_id: string;
  login_id: string | null;
  name: string | null;
};

type OwnedShopTarget = {
  id: string;
  name: string;
};

export async function POST(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const body = withdrawOwnerSchema.parse(await request.json());

    if (body.confirmation !== body.shopId) {
      throw new AdminApiError("회원탈퇴 확인 정보가 일치하지 않습니다.", 400);
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      throw new AdminApiError("Supabase 관리자 설정을 확인해 주세요.", 503);
    }

    const [profileResult, shopsResult, userResult] = await Promise.all([
      admin
        .from("owner_profiles")
        .select("user_id, shop_id, login_id, name")
        .eq("user_id", body.userId)
        .eq("shop_id", body.shopId)
        .maybeSingle<OwnerProfileTarget>(),
      admin
        .from("shops")
        .select("id, name")
        .eq("owner_user_id", body.userId)
        .returns<OwnedShopTarget[]>(),
      admin.auth.admin.getUserById(body.userId),
    ]);

    if (profileResult.error) {
      throw new AdminApiError(profileResult.error.message, 500);
    }
    if (shopsResult.error) {
      throw new AdminApiError(shopsResult.error.message, 500);
    }
    if (userResult.error || !userResult.data.user || !profileResult.data) {
      throw new AdminApiError("탈퇴시킬 오너 계정을 찾지 못했습니다.", 404);
    }

    const ownedShops = shopsResult.data ?? [];
    if (!ownedShops.some((shop) => shop.id === body.shopId)) {
      throw new AdminApiError("선택한 매장이 해당 오너 소유가 아닙니다.", 409);
    }

    // Auth 사용자를 먼저 완전 삭제해야 아이디·이메일·소셜 identity가 즉시 해제되어
    // 동일한 로그인 수단으로 다시 가입할 수 있다.
    const authDeleteResult = await admin.auth.admin.deleteUser(body.userId, false);
    if (authDeleteResult.error) {
      throw new AdminApiError(authDeleteResult.error.message || "로그인 계정을 삭제하지 못했습니다.", 400);
    }

    const ownedShopIds = ownedShops.map((shop) => shop.id);
    if (ownedShopIds.length > 0) {
      const shopsDeleteResult = await admin.from("shops").delete().in("id", ownedShopIds);
      if (shopsDeleteResult.error) {
        throw new AdminApiError(
          `로그인 계정은 삭제했지만 매장 데이터 정리에 실패했습니다: ${shopsDeleteResult.error.message}`,
          500,
        );
      }
    }

    return NextResponse.json({
      success: true,
      userId: body.userId,
      deletedShopIds: ownedShopIds,
      message: `${profileResult.data.name ?? profileResult.data.login_id ?? "오너"} 회원탈퇴가 완료되었습니다. 같은 로그인 수단으로 바로 다시 가입할 수 있습니다.`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "탈퇴시킬 오너 계정 정보를 다시 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof AdminApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "회원탈퇴 처리 중 문제가 발생했습니다." }, { status: 500 });
  }
}
