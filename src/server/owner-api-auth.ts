import { NextRequest } from "next/server";

import { getSupabaseAuthClient } from "@/lib/supabase/server";

export class OwnerApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
    this.name = "OwnerApiError";
  }
}

type CanonicalApiPath = "/api/bootstrap" | "/api/owner/shops" | "/api/subscription" | "/api/owner/initial-setup/hours" | "/api/staff-members";
type CanonicalApiMethod = "GET" | "PATCH";

export type CanonicalApiResult = {
  status: number;
  ok: boolean;
  body: unknown;
};

type CanonicalOwnerIdentity = {
  shopId: string;
  userId: string | null;
  email: string | null;
  createdAt: string | null;
  userMetadata: Record<string, unknown> | null;
};

const DEVELOPMENT_CANONICAL_ORIGINS = new Set([
  "http://127.0.0.1:3000",
  "http://localhost:3000",
]);

const PRODUCTION_CANONICAL_ORIGINS = new Set([
  "https://www.petmanager.co.kr",
]);

const PRODUCTION_CANONICAL_ORIGIN_ALIASES = new Map([
  ["https://app.petmanager.co.kr", "https://www.petmanager.co.kr"],
  ["https://petmanager.co.kr", "https://www.petmanager.co.kr"],
]);

const QUERY_KEYS_BY_PATH: Record<CanonicalApiPath, ReadonlySet<string>> = {
  "/api/bootstrap": new Set(["scope", "shopId", "phase"]),
  "/api/owner/shops": new Set(),
  "/api/subscription": new Set(["shopId"]),
  "/api/owner/initial-setup/hours": new Set(),
  "/api/staff-members": new Set(),
};

function isLoopbackOrigin(value: string | undefined) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.hostname === "127.0.0.1" || url.hostname === "localhost";
  } catch {
    return false;
  }
}

function isDevelopmentRuntime() {
  if (process.env.VERCEL_ENV === "production" || process.env.VERCEL_ENV === "preview") {
    return false;
  }
  if (
    isLoopbackOrigin(process.env.NEXT_PUBLIC_SITE_URL) ||
    isLoopbackOrigin(process.env.NEXT_PUBLIC_API_BASE_URL)
  ) {
    return true;
  }
  return process.env.NODE_ENV !== "production";
}

function parseOriginOnly(value: string, label: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new OwnerApiError(`${label} 주소 형식을 확인해 주세요.`, 503);
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
  if (user.app_metadata?.account_suspended === true) {
    throw new OwnerApiError("이 계정은 운영자에 의해 일시 중지되었습니다.", 403);
  }

  const shopsResult = await requestCanonicalApi({
    request,
    path: "/api/owner/shops",
    auth: "required",
  });
  const ownedShopIds = readOwnedShopIds(assertCanonicalSuccess(shopsResult, "매장 접근 권한을 확인하지 못했습니다."));
  if (ownedShopIds.length === 0) {
    throw new OwnerApiError("소유한 매장이 없습니다.", 403);
  }
  if (normalizedRequestedShopId && !ownedShopIds.includes(normalizedRequestedShopId)) {
    throw new OwnerApiError("다른 매장 데이터에는 접근할 수 없습니다.", 403);
  }

  return {
    shopId: normalizedRequestedShopId || ownedShopIds[0],
    userId: user.id,
    email: user.email ?? null,
    createdAt: user.created_at ?? null,
    userMetadata: (user.user_metadata as Record<string, unknown> | null | undefined) ?? null,
  };
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
