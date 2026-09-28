import { NextRequest } from "next/server";
import { z } from "zod";

import { hasCallIdServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { finalizeCatchCallEndedEvent } from "@/server/catch-call";
import {
  CALL_DIRECTIONS,
  CALL_EVENT_TYPES,
  callPhoneTail,
  hashCallPhone,
  isValidCallPhone,
  normalizeCallOccurredAt,
  normalizeCallPhone,
  sanitizeCallMetadata,
} from "@/server/call-id";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";

const EVENTS_CORS = { methods: "POST, OPTIONS" } as const;
const eventSchema = z.object({
  shopId: z.string().trim().min(1).max(160),
  integrationId: z.string().uuid(),
  providerEventId: z.string().trim().min(1).max(160),
  eventType: z.enum(CALL_EVENT_TYPES),
  direction: z.enum(CALL_DIRECTIONS),
  callerNumber: z.string().trim().min(1).max(40),
  occurredAt: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();

function message(request: NextRequest, text: string, status: number) {
  return ownerMobileCorsJson(request, { message: text }, { status }, EVENTS_CORS);
}

export async function POST(request: NextRequest) {
  try {
    const body = eventSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, body.shopId);
    const admin = getSupabaseAdmin();
    if (!hasCallIdServerEnv()) return message(request, "CALL_ID secrets are not configured.", 503);
    if (!admin) return message(request, "캐치콜 서버 설정을 확인해 주세요.", 503);

    const occurredAt = normalizeCallOccurredAt(body.occurredAt);
    if (!occurredAt || !isValidCallPhone(body.callerNumber)) return message(request, "통화 정보 형식을 확인해 주세요.", 400);

    const integration = await admin
      .from("call_integrations")
      .select("id,shop_id,provider,line_type,enabled")
      .eq("id", body.integrationId)
      .eq("shop_id", owner.shopId)
      .maybeSingle();
    if (integration.error || !integration.data || !integration.data.enabled) return message(request, "Android 통화 연결을 찾을 수 없습니다.", 404);

    const normalizedPhone = normalizeCallPhone(body.callerNumber);
    const guardiansResult = await admin
      .from("guardians")
      .select("id,name,phone")
      .eq("shop_id", owner.shopId)
      .is("deleted_at", null)
      .limit(10000);
    if (guardiansResult.error) return message(request, "고객 번호를 조회하지 못했습니다.", 500);

    const matches = (guardiansResult.data ?? []).filter((guardian) => normalizeCallPhone(guardian.phone) === normalizedPhone);
    const matchStatus = matches.length === 1 ? "matched" : matches.length > 1 ? "ambiguous" : "unmatched";
    const matchedGuardianId = matches.length === 1 ? matches[0].id : null;
    const finalizeEnded = async (eventId: string) => {
      if (body.eventType !== "ended") return;
      const providerCallId = typeof body.metadata?.providerCallId === "string" ? body.metadata.providerCallId : "";
      await finalizeCatchCallEndedEvent({ admin, shopId: owner.shopId, integrationId: body.integrationId, providerCallId, endedEventId: eventId });
    };
    const inserted = await admin
      .from("call_events")
      .insert({
        shop_id: owner.shopId,
        integration_id: body.integrationId,
        provider_event_id: body.providerEventId,
        event_type: body.eventType,
        direction: body.direction,
        phone_fingerprint: hashCallPhone(normalizedPhone),
        phone_tail: callPhoneTail(normalizedPhone),
        occurred_at: occurredAt,
        matched_guardian_id: matchedGuardianId,
        match_status: matchStatus,
        metadata: sanitizeCallMetadata(body.metadata),
      })
      .select("id")
      .single();

    if (inserted.error) {
      if (inserted.error.code === "23505") {
        const existing = await admin.from("call_events").select("id,match_status,matched_guardian_id").eq("integration_id", body.integrationId).eq("provider_event_id", body.providerEventId).maybeSingle();
        if (existing.data?.id) await finalizeEnded(existing.data.id);
        return ownerMobileCorsJson(request, { ok: true, accepted: true, replayed: true, eventId: existing.data?.id ?? null, matchStatus: existing.data?.match_status ?? null }, undefined, EVENTS_CORS);
      }
      return message(request, "캐치콜 이벤트를 저장하지 못했습니다.", 500);
    }

    await finalizeEnded(inserted.data.id);
    return ownerMobileCorsJson(request, { ok: true, accepted: true, replayed: false, eventId: inserted.data.id, matchStatus }, undefined, EVENTS_CORS);
  } catch (error) {
    if (error instanceof z.ZodError) return message(request, "Android 통화 이벤트 형식을 확인해 주세요.", 400);
    if (error instanceof OwnerApiError) return message(request, error.message, error.status);
    return message(request, "Android 통화 이벤트를 처리하지 못했습니다.", 500);
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, EVENTS_CORS);
}
