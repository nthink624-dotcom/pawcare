import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readOptionalBookingPolicy } from "@/server/booking-preparation";
export async function GET(request: NextRequest) {
  try {
    const shopId = z.string().min(1).max(100).parse(request.nextUrl.searchParams.get("shopId"));
    const r = await readOptionalBookingPolicy(shopId);
    const policy = r ? {
      depositMode: r.policy.depositMode, depositAudience: r.policy.depositAudience, depositAmount: r.policy.depositAmount,
      cancellationCutoffHours: r.policy.cancellationCutoffHours, cancellationNotice: r.policy.cancellationNotice,
      firstNoshowRule: r.policy.firstNoshowRule, repeatNoshowRule: r.policy.repeatNoshowRule,
    } : null;
    return NextResponse.json({ policy, version: r?.version ?? 0 }, { headers: { "Cache-Control": "no-store" } });
  } catch { return NextResponse.json({ message: "예약 정책을 불러오지 못했습니다." }, { status: 503 }); }
}
