import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

function isDateString(value: string | null) {
  return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedShopId = searchParams.get("shopId") || undefined;
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    if (!isDateString(from) || !isDateString(to)) {
      return ownerMobileCorsJson(request, { message: "조회할 날짜 범위가 필요합니다." }, { status: 400 });
    }

    const owner = await requireOwnerShop(request, requestedShopId);
    const data = await getBootstrap(owner.shopId, {
      allowMock: false,
      includeLanding: false,
      includeNotifications: true,
      appointmentsFrom: from ?? undefined,
      appointmentsTo: to ?? undefined,
      groomingRecordsFrom: from ?? undefined,
      groomingRecordsTo: to ?? undefined,
      groomingRecordLimit: 1000,
      notificationLimit: 200,
    });

    return ownerMobileCorsJson(request, {
      shopId: data.shop.id,
      from,
      to,
      appointments: data.appointments,
      groomingRecords: data.groomingRecords,
      notifications: data.notifications,
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return ownerMobileCorsJson(request, { message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "예약 범위 데이터를 불러오지 못했습니다.";
    return ownerMobileCorsJson(request, { message }, { status: 500 });
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request);
}
