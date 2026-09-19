import { NextRequest, NextResponse } from "next/server";

import {
  normalizeCanonicalShopId,
  OwnerApiError,
  requestCanonicalApi,
} from "@/server/owner-api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

function requireRecord(value: unknown, message: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new OwnerApiError(message, 502);
  }
  return value as Record<string, unknown>;
}

function projectPublicBootstrap(value: unknown) {
  const data = requireRecord(value, "정본 공개 응답을 확인해 주세요.");
  const shop = requireRecord(data.shop, "정본 공개 매장 정보를 확인해 주세요.");
  if (!Array.isArray(data.services) || (data.mode !== "mock" && data.mode !== "supabase")) {
    throw new OwnerApiError("정본 공개 응답 형식을 확인해 주세요.", 502);
  }

  return {
    mode: data.mode,
    shop,
    services: data.services,
    ...(data.priceGuideCore === undefined ? {} : { priceGuideCore: data.priceGuideCore }),
  };
}

function assertOwnerBootstrapBoundary(value: unknown, requestedShopId?: string) {
  const data = requireRecord(value, "정본 오너 응답을 확인해 주세요.");
  const shop = requireRecord(data.shop, "정본 오너 매장 정보를 확인해 주세요.");
  const responseShopId = typeof shop.id === "string" ? shop.id : "";
  if (!responseShopId || (requestedShopId && responseShopId !== requestedShopId)) {
    throw new OwnerApiError("선택한 매장의 정본 응답이 일치하지 않습니다.", 502);
  }

  const readiness = requireRecord(
    data.initialSetupReadiness,
    "매장 초기 설정 상태를 확인하지 못했습니다.",
  );
  if (readiness.completed !== true) {
    throw new OwnerApiError("매장 초기 설정을 완료한 뒤 이용해 주세요.", 409);
  }

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope") || "owner";
    if (scope !== "owner" && scope !== "public") {
      throw new OwnerApiError("bootstrap 요청 범위를 확인해 주세요.", 400);
    }

    const requestedShopId = normalizeCanonicalShopId(request.nextUrl.searchParams.get("shopId"));
    const query = new URLSearchParams({ scope });
    if (requestedShopId) query.set("shopId", requestedShopId);
    if (scope === "owner") query.set("phase", "full");

    const result = await requestCanonicalApi({
      request,
      path: "/api/bootstrap",
      searchParams: query,
      auth: scope === "owner" ? "required" : "omit",
    });
    if (!result.ok) {
      return jsonNoStore(result.body, { status: result.status });
    }

    return jsonNoStore(
      scope === "public"
        ? projectPublicBootstrap(result.body)
        : assertOwnerBootstrapBoundary(result.body, requestedShopId),
    );
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }

    return jsonNoStore({ message: "데이터를 불러오는 중 문제가 발생했습니다." }, { status: 500 });
  }
}
