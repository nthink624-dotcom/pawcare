import { NextRequest, NextResponse } from "next/server";

import { runDepositMaintenance } from "@/server/booking-deposit-ledger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const runId = crypto.randomUUID(), started = Date.now();
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() || undefined;
    // Tick only new ledger-linked bookings, then drain their durable notification outbox.
    const result = await runDepositMaintenance(shopId);
    // Counts and run identifiers only; never log customer IDs or money details.
    console.info("[booking-deposit-expiry] completed", { runId, durationMs: Date.now() - started, ...result });
    return NextResponse.json({ ok: true, runId, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    console.error("[booking-deposit-expiry] maintenance failed");
    return NextResponse.json({ ok: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
