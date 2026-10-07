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
    if (!admin) return errorResponse("CatchCall server is not configured.", 503);

    const eventResult = await admin
      .from("call_events")
      .select("id,integration_id,event_type,match_status")
      .eq("shop_id", owner.shopId)
      .eq("provider_event_id", `${body.providerCallId}:incoming`)
      .maybeSingle();
    if (eventResult.error) return errorResponse("Could not verify the incoming call event.", 500);
    if (!eventResult.data || eventResult.data.event_type !== "incoming") {
      return errorResponse("The incoming call has not reached the server yet.", 404);
    }
    if (eventResult.data.match_status !== "matched") {
      return errorResponse("Only a call matched to one registered customer can be recorded.", 409);
    }

    const integrationResult = await admin
      .from("call_integrations")
      .select("id")
      .eq("id", eventResult.data.integration_id)
      .eq("shop_id", owner.shopId)
      .eq("enabled", true)
      .maybeSingle();
    if (integrationResult.error) return errorResponse("Could not verify the call integration.", 500);
    if (!integrationResult.data) return errorResponse("No enabled call integration was found.", 404);

    const prior = await admin
      .from("call_event_actions")
      .select("id,action")
      .eq("call_event_id", eventResult.data.id)
      .maybeSingle();
    if (prior.error) return errorResponse("Could not verify the saved call choice.", 500);
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
      return errorResponse("Could not save the call choice.", 500);
    }

    return NextResponse.json({ ok: true, accepted: true, replayed: false, action: inserted.data.action, conflict: false });
  } catch (error) {
    if (error instanceof z.ZodError) return errorResponse("The call choice payload is invalid.", 400);
    if (error instanceof OwnerApiError) return errorResponse(error.message, error.status);
    return errorResponse("Could not process the call choice.", 500);
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: { Allow: "POST, OPTIONS" } });
}
