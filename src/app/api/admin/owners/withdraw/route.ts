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
    const adminAccount = await requireAdminSession(request);
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
        .is("deleted_at", null)
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

    const ownedShopIds = ownedShops.map((shop) => shop.id);
    const deletedAt = new Date().toISOString();
    const deletedByActor = `admin:${adminAccount.id}`;
    const softDeleteResult = await admin
      .from("shops")
      .update({
        deleted_at: deletedAt,
        deleted_by_actor: deletedByActor,
        deleted_reason: "owner_withdrawal",
      })
      .in("id", ownedShopIds)
      .is("deleted_at", null)
      .select("id");

    if (softDeleteResult.error || (softDeleteResult.data ?? []).length !== ownedShopIds.length) {
      throw new AdminApiError(
        softDeleteResult.error?.message || "매장 보관 처리를 완료하지 못했습니다. 회원탈퇴를 중단했습니다.",
        500,
      );
    }

    // Auth 계정을 삭제하기 전에 매장 데이터를 보관 처리합니다. Auth 삭제가 실패하면
    // 아래에서 매장 보관 상태를 원복해 두 작업이 어긋나지 않도록 합니다.
    const authDeleteResult = await admin.auth.admin.deleteUser(body.userId, false);
    if (authDeleteResult.error) {
      const rollbackResult = await admin
        .from("shops")
        .update({
          deleted_at: null,
          deleted_by_actor: null,
          deleted_reason: null,
        })
        .in("id", ownedShopIds)
        .eq("deleted_at", deletedAt)
        .eq("deleted_by_actor", deletedByActor);

      if (rollbackResult.error) {
        throw new AdminApiError(
          `계정 삭제에 실패했고 매장 보관 상태도 원복하지 못했습니다. 즉시 확인이 필요합니다: ${rollbackResult.error.message}`,
          500,
        );
      }

      throw new AdminApiError(authDeleteResult.error.message || "로그인 계정을 삭제하지 못했습니다.", 400);
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
