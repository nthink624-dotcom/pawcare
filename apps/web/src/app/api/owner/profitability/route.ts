import { NextRequest, NextResponse } from "next/server";

import { buildDemoProfitabilityPayload, loadProfitabilityPayload } from "@/server/profitability-analytics";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import type { ProfitabilityPayload, ProfitabilityRange } from "@/types/profitability";

export const dynamic = "force-dynamic";

const REALTIME_CACHE_TTL_MS = 15_000;
const profitabilityCache = new Map<string, { expiresAt: number; payload: ProfitabilityPayload }>();
const profitabilityRequests = new Map<string, Promise<ProfitabilityPayload>>();

function parseRange(value: string | null): ProfitabilityRange {
  return value === "30d" || value === "365d" ? value : "90d";
}

async function getCachedProfitabilityPayload(shopId: string, range: ProfitabilityRange, bypassCache: boolean) {
  const key = `${shopId}:${range}`;
  const cached = profitabilityCache.get(key);
  if (!bypassCache && cached && cached.expiresAt > Date.now()) return cached.payload;

  const inFlight = profitabilityRequests.get(key);
  if (!bypassCache && inFlight) return inFlight;

  const request = loadProfitabilityPayload(shopId, range)
    .then((payload) => {
      profitabilityCache.set(key, { payload, expiresAt: Date.now() + REALTIME_CACHE_TTL_MS });
      return payload;
    })
    .finally(() => {
      profitabilityRequests.delete(key);
    });
  profitabilityRequests.set(key, request);
  return request;
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    const range = parseRange(request.nextUrl.searchParams.get("range"));
    const bypassCache = request.nextUrl.searchParams.get("refresh") === "1";
    if (shopId === "demo-shop" || shopId === "owner-demo") {
      return NextResponse.json(buildDemoProfitabilityPayload(range), {
        headers: { "Cache-Control": "public, max-age=60" },
      });
    }

    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);

    const payload = await getCachedProfitabilityPayload(owner.shopId, range, bypassCache);

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=15, stale-while-revalidate=15" },
    });
  } catch (error) {
    if (error instanceof OwnerApiError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "시간당 수익 분석을 불러오지 못했습니다.";
    return NextResponse.json({ message }, { status: 500 });
  }
}
