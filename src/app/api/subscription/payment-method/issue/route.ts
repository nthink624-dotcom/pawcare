import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { issueOwnerBillingKeyViaApi } from "@/server/owner-billing-key-issue";
import { requireOwnerBillingSession } from "@/server/owner-billing-session";

export const runtime = "nodejs";

function digits(value: unknown) {
  return typeof value === "string" ? value.replace(/\D/g, "") : value;
}

const bodySchema = z.object({
  cardNumber: z.preprocess(digits, z.string().regex(/^\d{14,19}$/)),
  expiryYear: z.preprocess(digits, z.string().regex(/^\d{2}$/)),
  expiryMonth: z.preprocess(digits, z.string().regex(/^(0[1-9]|1[0-2])$/)),
  birthOrBusinessRegistrationNumber: z.preprocess(digits, z.string().regex(/^(\d{6}|\d{10})$/)),
  passwordTwoDigits: z.preprocess(digits, z.string().regex(/^\d{2}$/)),
  planCode: z.enum(["monthly", "quarterly", "halfyearly", "yearly"]),
  customerName: z.string().trim().min(1).max(100).optional(),
  phoneNumber: z.string().trim().max(30).optional(),
  email: z.string().trim().email().max(254).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const { identity, shopId } = await requireOwnerBillingSession(request);
    const payload = bodySchema.parse(await request.json());
    const summary = await issueOwnerBillingKeyViaApi(identity, shopId, payload);
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "카드 정보를 다시 확인해 주세요." }, { status: 400 });
    }

    if (error instanceof Error && "status" in error && typeof error.status === "number") {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: "카드를 등록하지 못했습니다." }, { status: 500 });
  }
}
