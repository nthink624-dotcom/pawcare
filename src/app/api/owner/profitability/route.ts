import { NextRequest, NextResponse } from "next/server";

import { buildDemoProfitabilityPayload, loadProfitabilityPayload } from "@/server/profitability-analytics";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import type { ProfitabilityRange } from "@/types/profitability";

export const dynamic = "force-dynamic";

function parseRange(value: string | null): ProfitabilityRange {
  return value === "30d" || value === "365d" ? value : "90d";
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    const range = parseRange(request.nextUrl.searchParams.get("range"));
    if (shopId === "demo-shop" || shopId === "owner-demo") {
      return NextResponse.json(buildDemoProfitabilityPayload(range), {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);

    const payload = await loadProfitabilityPayload(owner.shopId, range);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "시간당 수익 분석을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
