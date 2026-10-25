import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

const choiceSchema = z.object({
  shopId: z.string().trim().min(1).max(160),
  providerCallId: z.string().uuid(),
  action: z.enum(["reservation_selected", "phone_only_selected"]),
}).strict();

function errorResponse(message: string, status: number) {
  return NextResponse.json({ message }, { status });
}

export async function POST(request: NextRequest) {
  try {
    const body = choiceSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const admin = getSupabaseAdmin();
    if (!admin) return errorResponse("CatchCall 서버 설정을 확인해 주세요.", 503);

    const eventResult = await admin
      .from("call_events")
      .select("id,integration_id,event_type,match_status")
      .eq("shop_id", owner.shopId)
      .eq("provider_event_id", `${body.providerCallId}:incoming`)
      .maybeSingle();
    if (eventResult.error) return errorResponse("통화 이벤트를 확인하지 못했습니다.", 500);
    if (!eventResult.data || eventResult.data.event_type !== "incoming") {
      return errorResponse("선택을 기록할 수신 통화가 아직 서버에 도착하지 않았습니다.", 404);
    }
    if (eventResult.data.match_status !== "matched") {
      return errorResponse("등록 고객으로 확인된 통화만 선택을 기록할 수 있습니다.", 409);
    }

    const integrationResult = await admin
      .from("call_integrations")
      .select("id")
      .eq("id", eventResult.data.integration_id)
      .eq("shop_id", owner.shopId)
      .eq("enabled", true)
      .maybeSingle();
    if (integrationResult.error) return errorResponse("통화 연결을 확인하지 못했습니다.", 500);
    if (!integrationResult.data) return errorResponse("사용 가능한 통화 연결을 찾지 못했습니다.", 404);

    const prior = await admin
      .from("call_event_actions")
      .select("id,action")
      .eq("call_event_id", eventResult.data.id)
      .maybeSingle();
    if (prior.error) return errorResponse("통화 선택 기록을 확인하지 못했습니다.", 500);
    if (prior.data) {
      return NextResponse.json({
        ok: true,
        accepted: true,
        replayed: true,
        action: prior.data.action,
        conflict: prior.data.action !== body.action,
      });
    }

    const inserted = await admin
      .from("call_event_actions")
      .insert({
        shop_id: owner.shopId,
        integration_id: eventResult.data.integration_id,
        call_event_id: eventResult.data.id,
        action: body.action,
        selected_by_user_id: owner.userId,
      })
      .select("id,action")
      .single();
    if (inserted.error) {
      if (inserted.error.code === "23505") {
        const winner = await admin
          .from("call_event_actions")
          .select("id,action")
          .eq("call_event_id", eventResult.data.id)
          .maybeSingle();
        if (winner.data) {
          return NextResponse.json({
            ok: true,
            accepted: true,
            replayed: true,
            action: winner.data.action,
            conflict: winner.data.action !== body.action,
          });
        }
      }
      return errorResponse("통화 선택을 서버에 저장하지 못했습니다.", 500);
    }

    return NextResponse.json({ ok: true, accepted: true, replayed: false, action: inserted.data.action, conflict: false });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("통화 선택 정보가 올바르지 않습니다.", 400);
    if (error instanceof OwnerApiError) return errorResponse(error.message, error.status);
    return errorResponse("통화 선택을 처리하지 못했습니다.", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
}
