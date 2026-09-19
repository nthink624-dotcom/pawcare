import { NextRequest } from "next/server";

import { isOwnerSubscriptionBlocked } from "@/lib/billing/owner-subscription";
import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { getOwnerSubscriptionAccessStatus, OwnerBillingError } from "@/server/owner-billing";

export class OwnerApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
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
};

type StaffBindingRow = {
  id: string;
  shop_id: string;
  is_active: boolean | null;
  auth_user_id: string | null;
};

export type OwnerShopAccess = {
  shopId: string;
  role: OwnerShopRole;
  isPrimary: boolean;
  staffId: string | null;
};

export function getServerManagedAccountSuspension(
  appMetadata: Record<string, unknown> | null | undefined,
) {
  return {
    suspended: appMetadata?.account_suspended === true,
    suspensionReason:
      typeof appMetadata?.account_suspension_reason === "string" && appMetadata.account_suspension_reason.trim()
        ? appMetadata.account_suspension_reason.trim()
        : null,
  };
}

export function assertServerManagedAccountActive(user: {
  app_metadata?: Record<string, unknown> | null;
}) {
  if (getServerManagedAccountSuspension(user.app_metadata).suspended) {
    throw new OwnerApiError("이 계정은 운영자에 의해 일시 중지되었습니다.", 403);
  }
}

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

function isStaffRole(role: OwnerShopRole | string | null | undefined) {
  return role === "staff";
}

function rolePriority(role: OwnerShopRole) {
  if (role === "owner") return 0;
  if (role === "manager") return 1;
  return 2;
}

export function resolveOwnerShopAccess(params: {
  userId: string;
  ownedShops: ShopAccessRow[];
  memberships: MembershipRow[];
  staffBindings: StaffBindingRow[];
}) {
  const staffBindingByShopId = new Map<string, string>();
  for (const staff of params.staffBindings) {
    if (staff.auth_user_id === params.userId && staff.is_active === true) {
      staffBindingByShopId.set(staff.shop_id, staff.id);
    }
  }

  const candidates: OwnerShopAccess[] = [
    ...params.ownedShops.map((shop) => ({
      shopId: shop.id,
      role: "owner" as const,
      isPrimary: false,
      staffId: null,
    })),
    ...params.memberships.flatMap((membership): OwnerShopAccess[] => {
      if (isStaffRole(membership.role)) {
        const staffId = staffBindingByShopId.get(membership.shop_id);
        return staffId
          ? [{ shopId: membership.shop_id, role: "staff", isPrimary: membership.is_primary, staffId }]
          : [];
      }

      return [
        {
          shopId: membership.shop_id,
          role: membership.role,
          isPrimary: membership.is_primary,
          staffId: null,
        },
      ];
    }),
  ];

  const accessByShopId = new Map<string, OwnerShopAccess>();
  for (const access of candidates) {
    const previous = accessByShopId.get(access.shopId);
    if (
      !previous ||
      rolePriority(access.role) < rolePriority(previous.role) ||
      (access.role === previous.role && access.isPrimary && !previous.isPrimary)
    ) {
      accessByShopId.set(access.shopId, access);
    }
  }

  return Array.from(accessByShopId.values()).sort((first, second) => {
    if (first.isPrimary !== second.isPrimary) return first.isPrimary ? -1 : 1;
    if (first.role !== second.role) return rolePriority(first.role) - rolePriority(second.role);
    return first.shopId.localeCompare(second.shopId);
  });
}

export function isStaffOwnerContext(owner: Pick<OwnerShopContext, "role">) {
  return isStaffRole(owner.role);
}

export function assertOwnerOrManager(owner: Pick<OwnerShopContext, "role">) {
  if (isStaffRole(owner.role)) {
    throw new OwnerApiError("직원 계정은 이 작업을 수행할 수 없습니다.", 403);
  }
}

export async function loadOwnerShopAccessForUser(userId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
  }

  const [shopsResult, membershipResult] = await Promise.all([
    admin.from("shops").select("id").eq("owner_user_id", userId).order("created_at"),
    admin
      .from("owner_shop_memberships")
      .select("owner_user_id,shop_id,role,is_primary")
      .eq("owner_user_id", userId)
      .order("is_primary", { ascending: false }),
  ]);

  if (shopsResult.error) {
    throw new OwnerApiError(shopsResult.error.message, 500);
  }

  if (membershipResult.error && !isMissingMembershipsError(membershipResult.error)) {
    throw new OwnerApiError(membershipResult.error.message, 500);
  }

  const ownedShops = (shopsResult.data ?? []) as ShopAccessRow[];
  const memberships = membershipResult.error ? [] : ((membershipResult.data ?? []) as MembershipRow[]);
  const staffMembershipShopIds = Array.from(
    new Set(memberships.filter((membership) => isStaffRole(membership.role)).map((membership) => membership.shop_id)),
  );
  let staffBindings: StaffBindingRow[] = [];

  if (staffMembershipShopIds.length > 0) {
    const staffResult = await admin
      .from("staff_members")
      .select("id,shop_id,is_active,auth_user_id")
      .eq("auth_user_id", userId)
      .eq("is_active", true)
      .in("shop_id", staffMembershipShopIds);

    if (staffResult.error) {
      if (isMissingStaffAuthColumnError(staffResult.error)) {
        throw new OwnerApiError("직원 인증 연결 스키마를 확인해 주세요.", 503);
      }
      throw new OwnerApiError(staffResult.error.message, 500);
    }

    staffBindings = (staffResult.data ?? []) as StaffBindingRow[];
  }

  return resolveOwnerShopAccess({
    userId,
    ownedShops,
    memberships,
    staffBindings,
  });
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
  // getUser(token) performs a network lookup, so app_metadata comes from the current Auth user record.
  assertServerManagedAccountActive(user);

  const accessibleShops = await loadOwnerShopAccessForUser(user.id);
  const accessByShopId = new Map(accessibleShops.map((access) => [access.shopId, access]));

  if (accessByShopId.size === 0) {
    throw new OwnerApiError("소유한 매장이 없습니다.", 403);
  }

  if (requestedShopId && !accessByShopId.has(requestedShopId)) {
    throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
  }

  const resolvedAccess = requestedShopId ? accessByShopId.get(requestedShopId) : accessibleShops[0];
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
    const subscriptionStatus = await getOwnerSubscriptionAccessStatus(
      {
        id: billingOwnerUserId,
        email: resolvedAccess.role === "owner" ? user.email ?? null : null,
        created_at: resolvedAccess.role === "owner" ? user.created_at ?? null : null,
        user_metadata: resolvedAccess.role === "owner" ? user.user_metadata ?? null : null,
      },
      resolvedShopId,
    );

    if (isOwnerSubscriptionBlocked(subscriptionStatus)) {
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
    staffId: resolvedAccess.staffId,
  } satisfies OwnerShopContext;
}
