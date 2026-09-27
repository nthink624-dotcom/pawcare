import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasCallIdServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { createCallWebhookToken, hashCallWebhookToken } from "@/server/call-id";

const setupSchema = z.object({
  shopId: z.string().trim().min(1).max(160),
  deviceId: z.string().trim().min(8).max(160).regex(/^[A-Za-z0-9_-]+$/),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const body = setupSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    if (!owner.userId) return NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 });

    const admin = getSupabaseAdmin();
    if (!hasCallIdServerEnv()) return NextResponse.json({ message: "CALL_ID secrets are not configured." }, { status: 503 });
    if (!admin) return NextResponse.json({ message: "캐치콜 서버 설정을 확인해 주세요." }, { status: 503 });

    const externalLineId = `android:${body.deviceId}`;
    const existing = await admin
      .from("call_integrations")
      .select("id,enabled")
      .eq("shop_id", owner.shopId)
      .eq("provider", "generic")
      .eq("external_line_id", externalLineId)
      .maybeSingle();
    if (existing.error) return NextResponse.json({ message: "Android 통화 연결 상태를 확인하지 못했습니다." }, { status: 500 });
    if (existing.data) {
      if (!existing.data.enabled) {
        const reenabled = await admin
          .from("call_integrations")
          .update({ enabled: true, updated_at: new Date().toISOString() })
          .eq("id", existing.data.id)
          .eq("shop_id", owner.shopId)
          .select("id")
          .maybeSingle();
        if (reenabled.error || !reenabled.data) return NextResponse.json({ message: "Android 통화 연결을 다시 켜지 못했습니다." }, { status: 500 });
      }
      return NextResponse.json({ ok: true, integrationId: existing.data.id });
    }

    const webhookToken = createCallWebhookToken();
    const inserted = await admin
      .from("call_integrations")
      .insert({
        shop_id: owner.shopId,
        provider: "generic",
        line_type: "mobile",
        external_line_id: externalLineId,
        webhook_token_hash: hashCallWebhookToken(webhookToken),
        webhook_token_last4: webhookToken.slice(-4),
        enabled: true,
        created_by_user_id: owner.userId,
      })
      .select("id")
      .single();
    if (inserted.error || !inserted.data) return NextResponse.json({ message: "Android 통화 연결을 만들지 못했습니다." }, { status: 500 });
    return NextResponse.json({ ok: true, integrationId: inserted.data.id });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Android 통화 연결 정보를 확인해 주세요." }, { status: 400 });
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Android 통화 연결을 만들지 못했습니다." }, { status: 500 });
  }
}
