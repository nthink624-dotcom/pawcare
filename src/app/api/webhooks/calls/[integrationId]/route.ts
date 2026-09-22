import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { hasSupabaseServerEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  CALL_DIRECTIONS,
  CALL_EVENT_TYPES,
  callPhoneTail,
  hashCallPhone,
  hashCallWebhookToken,
  isValidCallPhone,
  normalizeCallOccurredAt,
  normalizeCallPhone,
  sanitizeCallMetadata,
  secureHashEquals,
} from "@/server/call-id";

const MAX_BODY_BYTES = 64 * 1024;
const callPayloadSchema = z.object({
  providerEventId: z.string().trim().min(1).max(160).optional(),
  eventId: z.string().trim().min(1).max(160).optional(),
  eventType: z.enum(CALL_EVENT_TYPES),
  direction: z.enum(CALL_DIRECTIONS).default("inbound"),
  callerNumber: z.string().trim().min(1).max(40),
  occurredAt: z.string().trim().max(80).optional(),
  provider: z.string().trim().max(80).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict().refine((value) => Boolean(value.providerEventId || value.eventId), {
  message: "providerEventId 또는 eventId가 필요합니다.",
  path: ["providerEventId"],
});

export async function POST(request: NextRequest, context: { params: Promise<{ integrationId: string }> }) {
  try {
    if (!hasSupabaseServerEnv()) return NextResponse.json({ ok: false, message: "콜아이디 서버 설정이 없습니다." }, { status: 503 });
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) {
      return NextResponse.json({ ok: false, message: "웹훅 본문이 너무 큽니다." }, { status: 413 });
    }

    const { integrationId } = await context.params;
    if (!/^[0-9a-f-]{36}$/i.test(integrationId)) {
      return NextResponse.json({ ok: false, message: "콜아이디 연동을 찾을 수 없습니다." }, { status: 404 });
    }
    const token = request.headers.get("x-petmanager-call-webhook-token")?.trim() ?? "";
    if (!token || token.length > 256) {
      return NextResponse.json({ ok: false, message: "웹훅 인증이 필요합니다." }, { status: 401 });
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ ok: false, message: "웹훅 본문 형식이 올바르지 않습니다." }, { status: 400 });
    }
    const payload = callPayloadSchema.parse(parsedJson);
    const providerEventId = payload.providerEventId ?? payload.eventId;
    if (!providerEventId) return NextResponse.json({ ok: false, message: "이벤트 ID가 필요합니다." }, { status: 400 });

    const occurredAt = normalizeCallOccurredAt(payload.occurredAt);
    if (!occurredAt) return NextResponse.json({ ok: false, message: "통화 시각 형식을 확인해 주세요." }, { status: 400 });
    if (!isValidCallPhone(payload.callerNumber)) {
      return NextResponse.json({ ok: false, message: "발신 번호 형식을 확인해 주세요." }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) return NextResponse.json({ ok: false, message: "콜아이디 데이터베이스 설정이 없습니다." }, { status: 503 });
    const integrationResult = await admin
      .from("call_integrations")
      .select("id,shop_id,provider,line_type,webhook_token_hash,enabled")
      .eq("id", integrationId)
      .maybeSingle();
    if (integrationResult.error || !integrationResult.data || !integrationResult.data.enabled) {
      return NextResponse.json({ ok: false, message: "콜아이디 연동을 찾을 수 없습니다." }, { status: 404 });
    }
    const expectedHash = hashCallWebhookToken(token);
    if (!secureHashEquals(expectedHash, integrationResult.data.webhook_token_hash.trim())) {
      return NextResponse.json({ ok: false, message: "웹훅 인증에 실패했습니다." }, { status: 401 });
    }
    if (payload.provider && payload.provider !== integrationResult.data.provider) {
      return NextResponse.json({ ok: false, message: "전화 공급사 정보가 일치하지 않습니다." }, { status: 400 });
    }

    const normalizedPhone = normalizeCallPhone(payload.callerNumber);
    const guardiansResult = await admin
      .from("guardians")
      .select("id,name,phone")
      .eq("shop_id", integrationResult.data.shop_id)
      .is("deleted_at", null)
      .limit(10000);
    if (guardiansResult.error) return NextResponse.json({ ok: false, message: "고객 번호를 대조하지 못했습니다." }, { status: 500 });

    const matches = (guardiansResult.data ?? []).filter((guardian) => normalizeCallPhone(guardian.phone) === normalizedPhone);
    const matchStatus = matches.length === 1 ? "matched" : matches.length > 1 ? "ambiguous" : "unmatched";
    const matchedGuardianId = matches.length === 1 ? matches[0].id : null;
    const inserted = await admin
      .from("call_events")
      .insert({
        shop_id: integrationResult.data.shop_id,
        integration_id: integrationId,
        provider_event_id: providerEventId,
        event_type: payload.eventType,
        direction: payload.direction,
        phone_fingerprint: hashCallPhone(normalizedPhone),
        phone_tail: callPhoneTail(normalizedPhone),
        occurred_at: occurredAt,
        matched_guardian_id: matchedGuardianId,
        match_status: matchStatus,
        metadata: sanitizeCallMetadata(payload.metadata),
      })
      .select("id");

    if (inserted.error) {
      if (inserted.error.code === "23505") {
        const existing = await admin
          .from("call_events")
          .select("id,match_status,matched_guardian_id")
          .eq("integration_id", integrationId)
          .eq("provider_event_id", providerEventId)
          .maybeSingle();
        return NextResponse.json({
          ok: true,
          accepted: true,
          replayed: true,
          eventId: existing.data?.id ?? null,
          matchStatus: existing.data?.match_status ?? null,
        });
      }
      return NextResponse.json({ ok: false, message: "콜아이디 이벤트를 저장하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      accepted: true,
      replayed: false,
      eventId: inserted.data?.[0]?.id ?? null,
      matchStatus,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ ok: false, message: "콜아이디 이벤트 형식을 확인해 주세요." }, { status: 400 });
    return NextResponse.json({ ok: false, message: "콜아이디 이벤트를 처리하지 못했습니다." }, { status: 500 });
  }
}
