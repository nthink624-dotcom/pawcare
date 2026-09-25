import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  CALL_ID_PROVIDERS,
  CALL_LINE_TYPES,
  createCallWebhookToken,
  hashCallWebhookToken,
  type CallIdProvider,
} from "@/server/call-id";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

const integrationSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  provider: z.enum(CALL_ID_PROVIDERS),
  lineType: z.enum(CALL_LINE_TYPES),
  externalLineId: z.string().trim().min(1).max(160),
}).strict();

function getAdmin() {
  if (!hasSupabaseServerEnv()) throw new OwnerApiError("콜아이디 연동을 위한 서버 설정이 필요합니다.", 503);
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("콜아이디 연동을 위한 데이터베이스 설정이 필요합니다.", 503);
  return admin;
}

function buildWebhookUrl(request: NextRequest, integrationId: string) {
  return new URL(`/api/webhooks/calls/${integrationId}`, request.nextUrl.origin).toString();
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId")?.trim() ?? "";
    if (!shopId) throw new OwnerApiError("매장 정보가 필요합니다.", 400);

    const owner = await requireOwnerShop(request, shopId);
    assertOwnerOrManager(owner);
    const admin = getAdmin();
    const result = await admin
      .from("call_integrations")
      .select("id,shop_id,provider,line_type,external_line_id,webhook_token_last4,enabled,created_at,updated_at")
      .eq("shop_id", owner.shopId)
      .order("created_at", { ascending: true });

    if (result.error) throw new OwnerApiError("콜아이디 연동 상태를 확인하지 못했습니다.", 500);

    return NextResponse.json({
      integrations: (result.data ?? []).map((row) => ({
        id: row.id,
        shopId: row.shop_id,
        provider: row.provider,
        lineType: row.line_type,
        externalLineId: row.external_line_id,
        webhookTokenLast4: row.webhook_token_last4,
        webhookUrl: buildWebhookUrl(request, row.id),
        enabled: row.enabled,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  } catch (error) {
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "콜아이디 연동 상태를 확인하지 못했습니다." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = integrationSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, parsed.shopId);
    assertOwnerOrManager(owner);
    const admin = getAdmin();
    const webhookToken = createCallWebhookToken();
    const inserted = await admin
      .from("call_integrations")
      .insert({
        shop_id: owner.shopId,
        provider: parsed.provider as CallIdProvider,
        line_type: parsed.lineType,
        external_line_id: parsed.externalLineId,
        webhook_token_hash: hashCallWebhookToken(webhookToken),
        webhook_token_last4: webhookToken.slice(-4),
        created_by_user_id: owner.userId,
      })
      .select("id,shop_id,provider,line_type,external_line_id,webhook_token_last4,enabled,created_at,updated_at")
      .single();

    if (inserted.error) {
      if (inserted.error.code === "23505") {
        throw new OwnerApiError("이미 연결된 전화 회선입니다.", 409);
      }
      throw new OwnerApiError("콜아이디 연동을 만들지 못했습니다.", 500);
    }

    return NextResponse.json({
      integration: {
        id: inserted.data.id,
        shopId: inserted.data.shop_id,
        provider: inserted.data.provider,
        lineType: inserted.data.line_type,
        externalLineId: inserted.data.external_line_id,
        webhookUrl: buildWebhookUrl(request, inserted.data.id),
        webhookToken,
        webhookTokenLast4: inserted.data.webhook_token_last4,
        enabled: inserted.data.enabled,
        createdAt: inserted.data.created_at,
        updatedAt: inserted.data.updated_at,
      },
      message: "웹훅 토큰은 지금 한 번만 표시됩니다. 전화 공급사 설정에 바로 등록해 주세요.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "콜아이디 연동 정보를 확인해 주세요." }, { status: 400 });
    if (error instanceof OwnerApiError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "콜아이디 연동을 만들지 못했습니다." }, { status: 500 });
  }
}
