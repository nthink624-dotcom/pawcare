import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { exchangeBookingAccessTokenForRebooking } from "@/server/booking-access-token";

const customerRebookingLinkSchema = z.object({
  shopId: z.string().min(1),
  accessToken: z.string().min(1),
  serviceId: z.string().trim().optional().default(""),
  serviceOptionId: z.string().trim().optional().default(""),
});

export async function POST(request: NextRequest) {
  try {
    const payload = customerRebookingLinkSchema.parse(await request.json());
    const rebookingToken = exchangeBookingAccessTokenForRebooking(payload.shopId, payload.accessToken);
    const query = new URLSearchParams({ experience: "revisit", t: rebookingToken });
    if (payload.serviceId) query.set("serviceId", payload.serviceId);
    if (payload.serviceOptionId) query.set("serviceOptionId", payload.serviceOptionId);

    return NextResponse.json({
      href: `/book/${encodeURIComponent(payload.shopId)}?${query.toString()}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "재예약 링크를 준비하지 못했습니다.";
    return NextResponse.json({ message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const shopId = request.nextUrl.searchParams.get("shopId")?.trim() ?? "";
  const accessToken = request.nextUrl.searchParams.get("t")?.trim() ?? "";

  try {
    const payload = customerRebookingLinkSchema.parse({ shopId, accessToken });
    const rebookingToken = exchangeBookingAccessTokenForRebooking(payload.shopId, payload.accessToken);
    const destination = new URL(`/book/${encodeURIComponent(payload.shopId)}`, request.nextUrl.origin);
    destination.searchParams.set("experience", "revisit");
    destination.searchParams.set("t", rebookingToken);
    return NextResponse.redirect(destination);
  } catch {
    if (!shopId) {
      return NextResponse.json({ message: "유효하지 않은 재예약 링크입니다." }, { status: 400 });
    }

    const fallback = new URL(`/entry/${encodeURIComponent(shopId)}`, request.nextUrl.origin);
    fallback.searchParams.set("experience", "revisit");
    fallback.searchParams.set("linkStatus", "expired");
    return NextResponse.redirect(fallback);
  }
}
