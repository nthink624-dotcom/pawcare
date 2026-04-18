import { NextRequest, NextResponse } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { OwnerApiError } from "@/server/owner-api-auth";

function isSuspendedMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.account_suspended === true;
}

export async function GET(request: NextRequest) {
  try {
    if (!hasSupabaseServerEnv()) {
      return NextResponse.json([
        {
          id: "demo-shop",
          name: "데모 매장",
          address: "서울시 강남구 테헤란로 1",
          heroImageUrl: "",
        },
      ]);
    }

    const authorization = request.headers.get("authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
    if (!token) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    const authClient = getSupabaseAuthClient();
    const admin = getSupabaseAdmin();
    if (!authClient || !admin) {
      throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
    }

    const userResult = await authClient.auth.getUser(token);
    if (userResult.error || !userResult.data.user) {
      throw new OwnerApiError("로그인이 필요합니다.", 401);
    }

    if (isSuspendedMetadata(userResult.data.user.user_metadata)) {
      throw new OwnerApiError("이 계정은 운영자에 의해 일시 중지되었습니다.", 403);
    }

    const shopsResult = await admin
      .from("shops")
      .select("id,name,address,customer_page_settings,created_at")
      .eq("owner_user_id", userResult.data.user.id)
      .order("created_at");

    if (shopsResult.error) {
      const missingCustomerPageSettings =
        /customer_page_settings/i.test(
          `${shopsResult.error.message} ${shopsResult.error.details ?? ""} ${shopsResult.error.hint ?? ""}`,
        ) &&
        (/column/i.test(shopsResult.error.message) || /schema cache/i.test(shopsResult.error.message));

      if (missingCustomerPageSettings) {
        const fallbackResult = await admin
          .from("shops")
          .select("id,name,address,created_at")
          .eq("owner_user_id", userResult.data.user.id)
          .order("created_at");

        if (fallbackResult.error) {
          throw new OwnerApiError(fallbackResult.error.message, 500);
        }

        return NextResponse.json(
          (fallbackResult.data ?? []).map((shop) => ({
            id: shop.id,
            name: shop.name,
            address: shop.address,
            heroImageUrl: "",
          })),
        );
      }

      throw new OwnerApiError(shopsResult.error.message, 500);
    }

    return NextResponse.json(
      (shopsResult.data ?? []).map((shop) => ({
        id: shop.id,
        name: shop.name,
        address: shop.address,
        heroImageUrl:
          typeof shop.customer_page_settings === "object" &&
          shop.customer_page_settings &&
          "hero_image_url" in shop.customer_page_settings &&
          typeof shop.customer_page_settings.hero_image_url === "string"
            ? shop.customer_page_settings.hero_image_url
            : "",
      })),
    );
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "매장 목록을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
