import { NextRequest, NextResponse } from "next/server";

import {
  checkCustomerBookingAccessRecoveryRateLimit,
  requestCustomerBookingAccessLink,
} from "@/server/customer-booking-access-recovery";

const NEUTRAL_MESSAGE = "예약 정보가 있다면 저장된 연락처로 예약 관리 링크를 보내드렸습니다.";

function getClientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function POST(request: NextRequest) {
  let body: { shopId?: unknown; phone?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // The neutral response must not reveal whether the request was parseable or matched a customer.
  }

  const shopId = typeof body.shopId === "string" ? body.shopId.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const allowed = checkCustomerBookingAccessRecoveryRateLimit({ phone, clientIp: getClientIp(request) });

  if (!allowed) {
    return NextResponse.json(
      { message: NEUTRAL_MESSAGE },
      { status: 429, headers: { "Retry-After": "900" } },
    );
  }

  const startedAt = Date.now();
  if (shopId && phone) {
    try {
      await requestCustomerBookingAccessLink({ shopId, phone });
    } catch (error) {
      console.error("[customer-booking-access-link] recovery dispatch failed", {
        shopId,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const remainingDelay = 250 - (Date.now() - startedAt);
  if (remainingDelay > 0) {
    await new Promise((resolve) => setTimeout(resolve, remainingDelay));
  }

  return NextResponse.json({ message: NEUTRAL_MESSAGE });
}
