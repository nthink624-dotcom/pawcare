import { NextRequest, NextResponse } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store, max-age=0");
  return NextResponse.json(body, { ...init, headers });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";
    const requestedShopId = searchParams.get("shopId") || undefined;

    if (scope === "public") {
      const shopId = requestedShopId || "demo-shop";
      const data = await getBootstrap(shopId);
      return jsonNoStore({
        mode: data.mode,
        shop: data.shop,
        services: data.services,
        staffMembers: data.staffMembers,
        appointments: data.appointments,
        groomingRecords: data.groomingRecords,
      });
    }

    const owner = await requireOwnerShop(request, requestedShopId);
    const data = await getBootstrap(owner.shopId);
    return jsonNoStore(data);
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return jsonNoStore({ message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "데이터를 불러오는 중 문제가 발생했습니다.";
    return jsonNoStore({ message }, { status: 500 });
  }
}
