import { Webhook } from "@portone/server-sdk";
import { NextRequest, NextResponse } from "next/server";

import { requireServerSecret, serverEnv, ServerEnvError } from "@/lib/server-env";
import { OwnerBillingError, syncOwnerSubscriptionFromPayment } from "@/server/owner-billing";

function extractPaymentId(webhook: { data?: unknown }) {
  const data = webhook.data;
  if (!data || typeof data !== "object") {
    return null;
  }

  const record = data as Record<string, unknown>;
  if (typeof record.paymentId === "string") {
    return record.paymentId;
  }
  if (typeof record.id === "string") {
    return record.id;
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();
    const webhookSecret = requireServerSecret(serverEnv.portoneWebhookSecret, "PORTONE_WEBHOOK_SECRET");
    const headers = Object.fromEntries(request.headers.entries());

    await Webhook.verify(webhookSecret, rawBody, headers);
    const payload = rawBody ? (JSON.parse(rawBody) as { data?: unknown }) : null;
    const paymentId = extractPaymentId(payload ?? {});

    if (!paymentId) {
      return NextResponse.json({ ok: true, ignored: true });
    }

    const summary = await syncOwnerSubscriptionFromPayment(paymentId);
    if (!summary) {
      return NextResponse.json({ ok: true, paymentId, ignored: true });
    }

    return NextResponse.json({ ok: true, paymentId, synced: true });
  } catch (error) {
    if (error instanceof Webhook.WebhookVerificationError) {
      return NextResponse.json({ ok: false, message: "유효하지 않은 웹훅 서명입니다." }, { status: 401 });
    }

    if (error instanceof ServerEnvError) {
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }

    if (error instanceof OwnerBillingError) {
      if (error.status === 404) {
        return NextResponse.json({ ok: true, ignored: true, message: error.message }, { status: 200 });
      }
      return NextResponse.json({ ok: false, message: error.message }, { status: error.status });
    }

    const message = error instanceof Error ? error.message : "포트원 웹훅을 처리하지 못했습니다.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
