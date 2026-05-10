import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";
    const requestedShopId = searchParams.get("shopId") || undefined;

    if (scope === "public") {
      const shopId = requestedShopId || "demo-shop";
      const data = await getBootstrap(shopId);
      return ownerMobileCorsJson(request, {
        mode: data.mode,
        shop: data.shop,
        services: data.services,
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }

    const owner = await requireOwnerShop(request, requestedShopId);
    const data = await getBootstrap(owner.shopId);
    return ownerMobileCorsJson(request, data);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "데이터를 불러오는 중 문제가 발생했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
