import { NextRequest, NextResponse } from "next/server";

import { syncOwnerSubscriptionFromPayment } from "@/server/owner-billing";

function extractPaymentId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;

  const record = payload as Record<string, unknown>;
  if (typeof record.paymentId === "string") return record.paymentId;
  if (typeof record.id === "string") return record.id;

  if (record.data && typeof record.data === "object") {
    const data = record.data as Record<string, unknown>;
    if (typeof data.paymentId === "string") return data.paymentId;
    if (typeof data.id === "string") return data.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => null);
    const paymentId = extractPaymentId(payload);

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const summary = await syncOwnerSubscriptionFromPayment(paymentId);
    return NextResponse.json({ ok: true, paymentId, synced: Boolean(summary) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "포트원 웹훅을 처리하지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
