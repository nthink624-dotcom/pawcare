import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import {
  getAdminAlimtalkCreditBalances,
  grantShopAlimtalkCredits,
  resetShopAlimtalkIncludedCredits,
} from "@/server/alimtalk-credit-service";

const grantCreditsSchema = z.object({
  action: z.enum(["grant", "reset-included"]).default("grant"),
  shopId: z.string().min(1),
  amount: z.number().int().positive().max(100000),
  creditBucket: z.enum(["included", "purchased"]).default("included"),
  periodStartedAt: z.string().datetime().optional(),
  periodEndsAt: z.string().datetime().nullable().optional(),
  reason: z.string().trim().max(120).optional(),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const balances = await getAdminAlimtalkCreditBalances();
    return NextResponse.json({ ok: true, balances });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 건수 정보를 불러오지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const adminSession = await requireAdminSession(request);
    const body = grantCreditsSchema.parse(await request.json());
    const metadata = { adminLoginId: adminSession.loginId };
    const result =
      body.action === "reset-included"
        ? await resetShopAlimtalkIncludedCredits({
            shopId: body.shopId,
            includedAmount: body.amount,
            periodStartedAt: body.periodStartedAt ?? null,
            periodEndsAt: body.periodEndsAt ?? null,
            reason: body.reason || "admin_monthly_included_reset",
            metadata,
          })
        : await grantShopAlimtalkCredits({
            shopId: body.shopId,
            amount: body.amount,
            creditBucket: body.creditBucket,
            reason: body.reason || "admin_grant",
            metadata,
          });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    const message = error instanceof Error ? error.message : "알림톡 건수 부여에 실패했습니다.";
    return NextResponse.json({ ok: false, message }, { status });
  }
}
