import { NextRequest } from "next/server";

import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { assertBootstrapOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { scopeBootstrapForStaff } from "@/server/staff-privacy";
import {
  getPriceGuideCoreContract,
  projectCanonicalPriceGuidesForRead,
} from "@/lib/price-guide-core";

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

  return data;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get("scope") || "owner";
    const requestedShopId = searchParams.get("shopId") || undefined;
    const requestedPhase = searchParams.get("phase");
    const phase = requestedPhase === "essential" || requestedPhase === "launch" ? requestedPhase : "full";

    if (scope === "public") {
      const shopId = requestedShopId || "demo-shop";
      const data = await getBootstrap(shopId, {
        includeLanding: false,
        includeNotifications: false,
        includeGroomingRecords: false,
        includePilotCohort: false,
      });
      assertBootstrapOwnerInitialSetupComplete(data);
      return ownerMobileCorsJson(request, {
        mode: data.mode,
        shop: data.shop,
        services: projectCanonicalPriceGuidesForRead(data.services),
        priceGuideCore: getPriceGuideCoreContract(),
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
      includeNotifications: phase === "full",
      includeGroomingRecords: phase === "full",
      includeOwnerExtras: phase === "full",
      includeOwnerProfile: phase === "full" || phase === "launch",
      includeStaffProfileImages: phase === "full",
      includePetDisplayPhotos: phase === "full",
    });
    const scoped = scopeBootstrapForStaff(data, owner);
    return ownerMobileCorsJson(request, {
      ...scoped,
      services: projectCanonicalPriceGuidesForRead(scoped.services),
      priceGuideCore: getPriceGuideCoreContract(),
    });
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
