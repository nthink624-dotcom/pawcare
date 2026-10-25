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
    this.name = "OwnerApiError";
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

  if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
    throw new OwnerApiError(`${label}에는 원점 주소만 사용할 수 있습니다.`, 503);
  }

  return url.origin;
}

function canonicalizeProductionApiOrigin(origin: string) {
  return PRODUCTION_CANONICAL_ORIGIN_ALIASES.get(origin) ?? origin;
}

export function getCanonicalApiOrigin() {
  const development = isDevelopmentRuntime();
  const configured = development
    ? process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://127.0.0.1:3000"
    : process.env.PETMANAGER_MAIN_APP_ORIGIN?.trim() ||
      (process.env.VERCEL_ENV === "production" ? "https://www.petmanager.co.kr" : "");

  if (!configured) {
    throw new OwnerApiError("정본 API 원점 설정을 확인해 주세요.", 503);
  }

  const parsedOrigin = parseOriginOnly(configured, "정본 API");
  const origin = development ? parsedOrigin : canonicalizeProductionApiOrigin(parsedOrigin);
  const allowedOrigins = development ? DEVELOPMENT_CANONICAL_ORIGINS : PRODUCTION_CANONICAL_ORIGINS;
  if (!allowedOrigins.has(origin)) {
    throw new OwnerApiError("허용되지 않은 정본 API 원점입니다.", 503);
  }
  if (!development && !origin.startsWith("https://")) {
    throw new OwnerApiError("운영 정본 API는 HTTPS 원점만 사용할 수 있습니다.", 503);
  }

  return origin;
}

export function normalizeCanonicalShopId(value: string | null | undefined) {
  if (value === null || value === undefined) return undefined;
  const shopId = value.trim();
  if (!shopId || shopId.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(shopId)) {
    throw new OwnerApiError("매장 정보를 다시 선택해 주세요.", 400);
  }
  return shopId;
}

function requireBearerAuthorization(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  const match = /^Bearer ([^\s,]+)$/.exec(authorization);
  if (!match?.[1] || match[1].length > 16_384) {
    throw new OwnerApiError("로그인이 필요합니다.", 401);
  }
  return `Bearer ${match[1]}`;
}

function readCanonicalErrorMessage(body: unknown, fallback: string) {
  if (
    body &&
    typeof body === "object" &&
    "message" in body &&
    typeof body.message === "string" &&
    body.message.trim()
  ) {
    return body.message;
  }
  return fallback;
}

export async function requestCanonicalApi(options: {
  request: NextRequest;
  path: CanonicalApiPath;
  method?: CanonicalApiMethod;
  searchParams?: URLSearchParams;
  body?: unknown;
  auth: "required" | "omit";
}): Promise<CanonicalApiResult> {
  const origin = getCanonicalApiOrigin();
  const url = new URL(options.path, `${origin}/`);
  if (url.origin !== origin || url.pathname !== options.path) {
    throw new OwnerApiError("정본 API 요청 경로를 확인해 주세요.", 503);
  }

  const allowedQueryKeys = QUERY_KEYS_BY_PATH[options.path];
  for (const [key, value] of options.searchParams ?? []) {
    if (!allowedQueryKeys.has(key) || key.length > 40 || value.length > 300) {
      throw new OwnerApiError("정본 API 요청 항목을 확인해 주세요.", 400);
    }
    url.searchParams.append(key, value);
  }

  const method = options.method ?? "GET";
  if (method === "GET" && options.body !== undefined) {
    throw new OwnerApiError("GET 요청에는 본문을 전달할 수 없습니다.", 400);
  }

  const headers = new Headers({ Accept: "application/json" });
  if (options.auth === "required") {
    headers.set("Authorization", requireBearerAuthorization(options.request));
  }
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      cache: "no-store",
      credentials: "omit",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new OwnerApiError("정본 API에 안전하게 연결하지 못했습니다.", 502);
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (text && !contentType.toLowerCase().includes("application/json")) {
    throw new OwnerApiError("정본 API 응답 형식을 확인해 주세요.", 502);
  }

  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new OwnerApiError("정본 API 응답을 읽지 못했습니다.", 502);
    }
  }

  return { status: response.status, ok: response.ok, body };
}

function assertCanonicalSuccess(result: CanonicalApiResult, fallback: string) {
  if (!result.ok) {
    throw new OwnerApiError(readCanonicalErrorMessage(result.body, fallback), result.status);
  }
  return result.body;
}

function readOwnedShopIds(body: unknown) {
  if (!Array.isArray(body)) {
    throw new OwnerApiError("정본 매장 목록 응답을 확인해 주세요.", 502);
  }
  return body.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item) || typeof item.id !== "string") {
      return [];
    }
    try {
      return [normalizeCanonicalShopId(item.id)!];
    } catch {
      return [];
    }
  });
}

export async function requireCanonicalOwnerIdentity(
  request: NextRequest,
  requestedShopId?: string,
): Promise<CanonicalOwnerIdentity> {
  const normalizedRequestedShopId = normalizeCanonicalShopId(requestedShopId);
  const authorization = requireBearerAuthorization(request);
  const authClient = getSupabaseAuthClient(AbortSignal.timeout(15_000));

  if (!authClient) {
    if (isDevelopmentRuntime()) {
      return {
        shopId: normalizedRequestedShopId || "demo-shop",
        userId: null,
        email: null,
        createdAt: null,
        userMetadata: null,
      };
    }
    throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
  }

  const token = authorization.slice("Bearer ".length);
  const userResult = await authClient.auth.getUser(token);
  const user = userResult.data.user;
  if (userResult.error || !user) {
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

export async function requireOwnerShop(request: NextRequest, requestedShopId?: string) {
  const owner = await requireCanonicalOwnerIdentity(request, requestedShopId);
  if (owner.userId === null && isDevelopmentRuntime()) {
    return { shopId: owner.shopId, userId: null as string | null };
  }

  const query = new URLSearchParams({
    scope: "owner",
    shopId: owner.shopId,
    phase: "essential",
  });
  const bootstrapResult = await requestCanonicalApi({
    request,
    path: "/api/bootstrap",
    searchParams: query,
    auth: "required",
  });
  const body = assertCanonicalSuccess(bootstrapResult, "오너 접근 권한을 확인하지 못했습니다.");
  if (!body || typeof body !== "object") {
    throw new OwnerApiError("정본 오너 응답을 확인해 주세요.", 502);
  }

  const shop = "shop" in body && body.shop && typeof body.shop === "object" ? body.shop : null;
  const responseShopId = shop && "id" in shop && typeof shop.id === "string" ? shop.id : "";
  if (responseShopId !== owner.shopId) {
    throw new OwnerApiError("선택한 매장의 정본 응답이 일치하지 않습니다.", 502);
  }

  const readiness =
    "initialSetupReadiness" in body && body.initialSetupReadiness && typeof body.initialSetupReadiness === "object"
      ? body.initialSetupReadiness
      : null;
  if (!readiness || !("completed" in readiness) || readiness.completed !== true) {
    throw new OwnerApiError("매장 초기 설정을 완료한 뒤 이용해 주세요.", 409);
  }

  return { shopId: owner.shopId, userId: owner.userId };
}
