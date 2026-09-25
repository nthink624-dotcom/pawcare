import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCanonicalShopId,
  OwnerApiError,
  requestCanonicalApi,
  requireCanonicalOwnerIdentity,
} from "@/server/owner-api-auth";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

async function resolveShopId(request: NextRequest) {
  const requestedShopId = normalizeCanonicalShopId(request.nextUrl.searchParams.get("shopId"));
  if (requestedShopId) return requestedShopId;
  return (await requireCanonicalOwnerIdentity(request)).shopId;
}

async function forward(request: NextRequest, method: "GET" | "PATCH", body?: unknown) {
  const shopId = await resolveShopId(request);
  const result = await requestCanonicalApi({
    request,
    path: "/api/subscription",
    method,
    searchParams: new URLSearchParams({ shopId }),
    body,
    auth: "required",
  });
  return jsonNoStore(result.body, { status: result.status });
}

export async function GET(request: NextRequest) {
  try {
    return await forward(request, "GET");
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }
    return jsonNoStore({ message: "구독 정보를 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new OwnerApiError("구독 변경 요청 형식이 올바르지 않습니다.", 400);
    }
    return await forward(request, "PATCH", body);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }
    return jsonNoStore({ message: "구독 정보를 저장하지 못했습니다." }, { status: 500 });
  }
}
