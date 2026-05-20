import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function getOwnerInitialDataWindow() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0);
  return {
    from: formatDate(from),
    to: formatDate(to),
    groomingFrom: formatDate(addMonths(now, -3)),
  };
}

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
    const initialWindow = getOwnerInitialDataWindow();
    const data = await getBootstrap(owner.shopId, {
      allowMock: false,
      includeLanding: false,
      appointmentsFrom: initialWindow.from,
      appointmentsTo: initialWindow.to,
      groomingRecordsFrom: initialWindow.groomingFrom,
      groomingRecordsTo: initialWindow.to,
      groomingRecordLimit: 1000,
      notificationLimit: 200,
    });
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
