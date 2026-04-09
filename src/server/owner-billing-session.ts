import { NextRequest } from "next/server";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import type { BillingIdentity } from "@/server/owner-billing";
import { OwnerBillingError } from "@/server/owner-billing";

type OwnerBillingSession = {
  identity: BillingIdentity;
  shopId: string;
};

export async function requireOwnerBillingSession(request: NextRequest): Promise<OwnerBillingSession> {
  if (!hasSupabaseServerEnv()) {
    return {
      identity: {
        id: "demo-owner",
        email: null,
        created_at: null,
        user_metadata: null,
      },
      shopId: "demo-shop",
    };
  }

  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";

  if (!token) {
    throw new OwnerBillingError("로그인이 필요합니다.", 401);
  }

  const authClient = getSupabaseAuthClient();
  const admin = getSupabaseAdmin();

  if (!authClient || !admin) {
    throw new OwnerBillingError("인증 설정을 확인해 주세요.", 503);
  }

  const userResult = await authClient.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    throw new OwnerBillingError("로그인이 필요합니다.", 401);
  }

  const user = userResult.data.user;
  const shopResult = await admin.from("shops").select("id").eq("owner_user_id", user.id).maybeSingle();

  if (shopResult.error) {
    throw new OwnerBillingError(shopResult.error.message, 500);
  }

  if (!shopResult.data?.id) {
    throw new OwnerBillingError("연결된 매장 정보를 찾을 수 없습니다.", 403);
  }

  return {
    identity: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      user_metadata: user.user_metadata ?? null,
    },
    shopId: shopResult.data.id,
  };
}
