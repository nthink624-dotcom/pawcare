import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCanonicalShopId,
  OwnerApiError,
  requestCanonicalApi,
} from "@/server/owner-api-auth";

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

async function forward(request: NextRequest, method: "GET" | "PATCH", body?: unknown) {
  const result = await requestCanonicalApi({
    request,
    path: "/api/owner/shops",
    method,
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
    return jsonNoStore({ message: "매장 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      throw new OwnerApiError("매장 정보를 다시 확인해 주세요.", 400);
    }
    const record = body as Record<string, unknown>;
    if (typeof record.shopId !== "string") {
      throw new OwnerApiError("매장 정보를 다시 확인해 주세요.", 400);
    }
    normalizeCanonicalShopId(record.shopId);
    return await forward(request, "PATCH", record);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }
    return jsonNoStore({ message: "매장 정보를 저장하지 못했습니다." }, { status: 400 });
  }
}
