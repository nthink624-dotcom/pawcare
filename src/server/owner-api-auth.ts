import { NextRequest } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";

export class OwnerApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function requireOwnerShop(request: NextRequest, requestedShopId?: string) {
  if (!hasSupabaseServerEnv()) {
    return {
      shopId: requestedShopId || "demo-shop",
      userId: null as string | null,
    };
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

  const shopResult = await admin.from("shops").select("id").eq("owner_user_id", userResult.data.user.id).maybeSingle();
  if (shopResult.error) {
    throw new OwnerApiError(shopResult.error.message, 500);
  }

  if (!shopResult.data?.id) {
    throw new OwnerApiError("소유한 매장이 없습니다.", 403);
  }

  if (requestedShopId && requestedShopId !== shopResult.data.id) {
    throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
  }

  return {
    shopId: shopResult.data.id,
    userId: userResult.data.user.id,
  };
}
