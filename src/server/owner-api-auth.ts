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

export type OwnerShopRole = "owner" | "manager" | "staff";

export type OwnerShopContext = {
  shopId: string;
  userId: string | null;
  role: OwnerShopRole;
  staffId: string | null;
};

type MembershipRow = {
  owner_user_id: string;
  shop_id: string;
  role: OwnerShopRole;
  is_primary: boolean;
};

type ShopAccessRow = {
  id: string;
  owner_user_id: string | null;
};

function isMissingMembershipsError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42P01" ||
    error?.code === "PGRST205" ||
    message.includes("owner_shop_memberships") ||
    message.includes("schema cache")
  );
}

function isMissingStaffAuthColumnError(error: { code?: string; message?: string } | null | undefined) {
  const message = error?.message?.toLowerCase() ?? "";
  return (
    error?.code === "42703" ||
    error?.code === "PGRST204" ||
    (message.includes("staff_members") && message.includes("auth_user_id")) ||
    message.includes("schema cache")
  );
}

function readMetadataStaffId(metadata: Record<string, unknown> | null | undefined) {
  const value =
    metadata?.staff_member_id ??
    metadata?.staffMemberId ??
    metadata?.staff_id ??
    metadata?.staffId;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isStaffRole(role: OwnerShopRole | string | null | undefined) {
  return role === "staff";
}

export function isStaffOwnerContext(owner: Pick<OwnerShopContext, "role">) {
  return isStaffRole(owner.role);
}

export function assertOwnerOrManager(owner: Pick<OwnerShopContext, "role">) {
  if (isStaffRole(owner.role)) {
    throw new OwnerApiError("직원 계정은 이 작업을 수행할 수 없습니다.", 403);
  }
}

async function loadStaffIdForUser(params: {
  userId: string;
  shopId: string;
  metadata: Record<string, unknown> | null | undefined;
}) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
  }

  const metadataStaffId = readMetadataStaffId(params.metadata);
  if (metadataStaffId) {
    const result = await admin
      .from("staff_members")
      .select("id,shop_id,is_active")
      .eq("id", metadataStaffId)
      .eq("shop_id", params.shopId)
      .maybeSingle();

    if (result.error) {
      throw new OwnerApiError(result.error.message, 500);
    }
    if (result.data?.id && result.data.is_active !== false) {
      return result.data.id as string;
    }
  }

  const result = await admin
    .from("staff_members")
    .select("id,shop_id,is_active,auth_user_id")
    .eq("shop_id", params.shopId)
    .eq("auth_user_id", params.userId)
    .maybeSingle();

  if (!result.error && result.data?.id && result.data.is_active !== false) {
    return result.data.id as string;
  }

  if (result.error && !isMissingStaffAuthColumnError(result.error)) {
    throw new OwnerApiError(result.error.message, 500);
  }

  throw new OwnerApiError("직원 계정과 직원 프로필이 연결되지 않았습니다.", 403);
}

export async function requireOwnerShop(request: NextRequest, requestedShopId?: string) {
  if (!hasSupabaseServerEnv()) {
    return {
      shopId: requestedShopId || "demo-shop",
      userId: null as string | null,
      role: "owner" as const,
      staffId: null,
    } satisfies OwnerShopContext;
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
    .select("id,owner_user_id")
    .eq("owner_user_id", user.id)
    .order("created_at");

  if (shopsResult.error) {
    throw new OwnerApiError(shopsResult.error.message, 500);
  }

  const ownedShops = (shopsResult.data ?? []) as ShopAccessRow[];
  const membershipResult = await admin
    .from("owner_shop_memberships")
    .select("owner_user_id,shop_id,role,is_primary")
    .eq("owner_user_id", user.id)
    .order("is_primary", { ascending: false });

  if (membershipResult.error && !isMissingMembershipsError(membershipResult.error)) {
    throw new OwnerApiError(membershipResult.error.message, 500);
  }

  const memberships = membershipResult.error ? [] : ((membershipResult.data ?? []) as MembershipRow[]);
  const accessibleShops = [
    ...ownedShops.map((shop) => ({
      shopId: shop.id,
      ownerUserId: shop.owner_user_id,
      role: "owner" as OwnerShopRole,
      isPrimary: false,
    })),
    ...memberships.map((membership) => ({
      shopId: membership.shop_id,
      ownerUserId: null as string | null,
      role: membership.role,
      isPrimary: membership.is_primary,
    })),
  ];

  const uniqueAccessByShopId = new Map<string, (typeof accessibleShops)[number]>();
  for (const access of accessibleShops) {
    const previous = uniqueAccessByShopId.get(access.shopId);
    if (!previous || previous.role === "staff" || access.role === "owner" || access.isPrimary) {
      uniqueAccessByShopId.set(access.shopId, access);
    }
  }

  if (uniqueAccessByShopId.size === 0) {
    throw new OwnerApiError("소유한 매장이 없습니다.", 403);
  }

  if (requestedShopId && !uniqueAccessByShopId.has(requestedShopId)) {
    throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
  }

  const sortedAccess = Array.from(uniqueAccessByShopId.values()).sort((first, second) => {
    if (first.isPrimary !== second.isPrimary) return first.isPrimary ? -1 : 1;
    if (first.role !== second.role) return first.role === "owner" ? -1 : 1;
    return first.shopId.localeCompare(second.shopId);
  });
  const resolvedAccess = requestedShopId ? uniqueAccessByShopId.get(requestedShopId) : sortedAccess[0];
  if (!resolvedAccess) {
    throw new OwnerApiError("매장 접근 권한을 확인하지 못했습니다.", 403);
  }

  const resolvedShopId = resolvedAccess.shopId;
  let billingOwnerUserId = user.id;
  if (resolvedAccess.role !== "owner") {
    const shopResult = await admin.from("shops").select("owner_user_id").eq("id", resolvedShopId).maybeSingle();
    if (shopResult.error) {
      throw new OwnerApiError(shopResult.error.message, 500);
    }
    billingOwnerUserId = typeof shopResult.data?.owner_user_id === "string" ? shopResult.data.owner_user_id : user.id;
  }

  try {
    const subscription = await getOwnerSubscriptionSummary(
      {
        id: billingOwnerUserId,
        email: resolvedAccess.role === "owner" ? user.email ?? null : null,
        created_at: resolvedAccess.role === "owner" ? user.created_at ?? null : null,
        user_metadata: resolvedAccess.role === "owner" ? user.user_metadata ?? null : null,
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
    role: resolvedAccess.role,
    staffId: isStaffRole(resolvedAccess.role)
      ? await loadStaffIdForUser({
          userId: user.id,
          shopId: resolvedShopId,
          metadata: user.user_metadata ?? null,
        })
      : null,
  } satisfies OwnerShopContext;
}
