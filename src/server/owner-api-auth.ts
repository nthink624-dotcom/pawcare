import { NextRequest } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { getOwnerSubscriptionSummary, OwnerBillingError } from "@/server/owner-billing";

export class OwnerApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

function isSuspendedMetadata(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.account_suspended === true;
}

function isBlockedSubscriptionStatus(status: string) {
  return status === "expired" || status === "past_due";
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

  const user = userResult.data.user;
  if (isSuspendedMetadata(user.user_metadata)) {
    throw new OwnerApiError("이 계정은 운영자에 의해 일시 중지되었습니다.", 403);
  }

  const shopsResult = await admin
    .from("shops")
    .select("id")
    .eq("owner_user_id", user.id)
    .order("created_at");

  if (shopsResult.error) {
    throw new OwnerApiError(shopsResult.error.message, 500);
  }

  const ownedShopIds = (shopsResult.data ?? []).map((shop) => shop.id).filter(Boolean);
  if (ownedShopIds.length === 0) {
    throw new OwnerApiError("소유한 매장이 없습니다.", 403);
  }

  if (requestedShopId && !ownedShopIds.includes(requestedShopId)) {
    throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
  }

  const resolvedShopId = requestedShopId || ownedShopIds[0];

  try {
    const subscription = await getOwnerSubscriptionSummary(
      {
        id: user.id,
        email: user.email ?? null,
        created_at: user.created_at ?? null,
        user_metadata: user.user_metadata ?? null,
      },
      resolvedShopId,
    );

    if (isBlockedSubscriptionStatus(subscription.status)) {
      throw new OwnerApiError("서비스 이용 기간이 만료되었습니다. 결제 정보를 확인해 주세요.", 402);
    }
  } catch (error) {
    if (error instanceof OwnerApiError) {
      throw error;
    }

    if (error instanceof OwnerBillingError) {
      throw new OwnerApiError(error.message, error.status);
    }

    throw error;
  }

  return {
    shopId: resolvedShopId,
    userId: user.id,
  };
}
