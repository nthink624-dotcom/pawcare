import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { OwnerApiError, requireOwnerShop, type OwnerShopContext } from "@/server/owner-api-auth";
import { careReportObservationsSchema } from "@/types/care-report";

export const dynamic = "force-dynamic";

const draftInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  treatmentNotes: z.string().max(2000).default(""),
  specialNotes: z.string().max(2000).default(""),
  internalNotes: z.string().max(4000).default(""),
  nextRecommendedVisitDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  afterMediaAssetId: z.string().trim().min(1).nullable().default(null),
  careReportObservations: careReportObservationsSchema.optional(),
  careReportVoiceTranscript: z.string().trim().max(4000).optional(),
  careReportPhotoConsent: z.boolean().optional(),
});

type DraftRow = {
  id: string;
  shop_id: string;
  appointment_id: string;
  guardian_id: string;
  pet_id: string;
  treatment_notes: string;
  special_notes: string;
  internal_notes: string;
  next_recommended_visit_date: string | null;
  after_media_asset_id: string | null;
  care_report_observations: Record<string, unknown>;
  care_report_voice_transcript: string;
  care_report_ai_draft: Record<string, unknown> | null;
  care_report_generation_id: string | null;
  care_report_owner_confirmed_at: string | null;
  care_report_photo_consent: boolean;
  updated_at: string;
};

type AppointmentScope = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  staff_id: string | null;
  status: string;
};

const demoDrafts = new Map<string, DraftRow>();

function draftKey(shopId: string, appointmentId: string) {
  return `${shopId}:${appointmentId}`;
}

function serializeDraft(row: DraftRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    shopId: row.shop_id,
    appointmentId: row.appointment_id,
    guardianId: row.guardian_id,
    petId: row.pet_id,
    treatmentNotes: row.treatment_notes,
    specialNotes: row.special_notes,
    internalNotes: row.internal_notes,
    nextRecommendedVisitDate: row.next_recommended_visit_date,
    afterMediaAssetId: row.after_media_asset_id,
    careReportObservations: row.care_report_observations,
    careReportVoiceTranscript: row.care_report_voice_transcript,
    careReportAiDraft: row.care_report_ai_draft,
    careReportGenerationId: row.care_report_generation_id,
    careReportOwnerConfirmedAt: row.care_report_owner_confirmed_at,
    careReportPhotoConsent: row.care_report_photo_consent,
    updatedAt: row.updated_at,
  };
}

async function requireAppointmentScope(owner: OwnerShopContext, appointmentId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return null;

  const result = await admin
    .from("appointments")
    .select("id,shop_id,guardian_id,pet_id,staff_id,status")
    .eq("id", appointmentId)
    .eq("shop_id", owner.shopId)
    .maybeSingle();

  if (result.error) throw new OwnerApiError(result.error.message, 500);
  if (!result.data) throw new OwnerApiError("미용 기록을 작성할 예약을 찾지 못했습니다.", 404);

  const appointment = result.data as AppointmentScope;
  if (owner.role === "staff" && appointment.staff_id !== owner.staffId) {
    throw new OwnerApiError("본인 담당 예약의 미용 기록만 작성할 수 있습니다.", 403);
  }

  return appointment;
}

async function requireAfterMediaAsset(params: {
  shopId: string;
  appointmentId: string;
  mediaAssetId: string | null;
}) {
  if (!params.mediaAssetId) return;
  const admin = getSupabaseAdmin();
  if (!admin) return;

  const result = await admin
    .from("media_assets")
    .select("id")
    .eq("id", params.mediaAssetId)
    .eq("shop_id", params.shopId)
    .eq("appointment_id", params.appointmentId)
    .eq("media_kind", "grooming_after")
    .eq("status", "ready")
    .is("deleted_at", null)
    .maybeSingle();

  if (result.error) throw new OwnerApiError(result.error.message, 500);
  if (!result.data) {
    throw new OwnerApiError("이 예약에 연결된 미용 완료 사진을 확인할 수 없습니다.", 400);
  }
}

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof OwnerApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ message: "임시저장할 미용 기록 형식을 확인해 주세요." }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    const appointmentId = request.nextUrl.searchParams.get("appointmentId")?.trim() ?? "";
    if (!appointmentId) throw new OwnerApiError("appointmentId가 필요합니다.", 400);

    const owner = await requireOwnerShop(request, shopId);
    const appointment = await requireAppointmentScope(owner, appointmentId);
    const admin = getSupabaseAdmin();
    if (!admin || !appointment) {
      return NextResponse.json({ draft: serializeDraft(demoDrafts.get(draftKey(owner.shopId, appointmentId)) ?? null) });
    }

    const result = await admin
      .from("grooming_record_drafts")
      .select("*")
      .eq("shop_id", owner.shopId)
      .eq("appointment_id", appointmentId)
      .maybeSingle();
    if (result.error) throw new OwnerApiError(result.error.message, 500);

    return NextResponse.json(
      { draft: serializeDraft((result.data as DraftRow | null) ?? null) },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return errorResponse(error, "미용 기록 임시저장을 불러오지 못했습니다.");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const input = draftInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    const appointment = await requireAppointmentScope(owner, input.appointmentId);
    await requireAfterMediaAsset({
      shopId: owner.shopId,
      appointmentId: input.appointmentId,
      mediaAssetId: input.afterMediaAssetId,
    });

    const now = new Date().toISOString();
    const admin = getSupabaseAdmin();
    if (!admin || !appointment) {
      const key = draftKey(owner.shopId, input.appointmentId);
      const previous = demoDrafts.get(key);
      const row: DraftRow = {
        id: previous?.id ?? `draft-${input.appointmentId}`,
        shop_id: owner.shopId,
        appointment_id: input.appointmentId,
        guardian_id: previous?.guardian_id ?? "demo-guardian",
        pet_id: previous?.pet_id ?? "demo-pet",
        treatment_notes: input.treatmentNotes,
        special_notes: input.specialNotes,
        internal_notes: input.internalNotes,
        next_recommended_visit_date: input.nextRecommendedVisitDate,
        after_media_asset_id: input.afterMediaAssetId,
        care_report_observations: input.careReportObservations ?? previous?.care_report_observations ?? {},
        care_report_voice_transcript: input.careReportVoiceTranscript ?? previous?.care_report_voice_transcript ?? "",
        care_report_ai_draft: previous?.care_report_ai_draft ?? null,
        care_report_generation_id: previous?.care_report_generation_id ?? null,
        care_report_owner_confirmed_at: previous?.care_report_owner_confirmed_at ?? null,
        care_report_photo_consent: input.careReportPhotoConsent ?? previous?.care_report_photo_consent ?? false,
        updated_at: now,
      };
      demoDrafts.set(key, row);
      return NextResponse.json({ draft: serializeDraft(row) });
    }

    const result = await admin
      .from("grooming_record_drafts")
      .upsert(
        {
          shop_id: owner.shopId,
          appointment_id: appointment.id,
          guardian_id: appointment.guardian_id,
          pet_id: appointment.pet_id,
          treatment_notes: input.treatmentNotes,
          special_notes: input.specialNotes,
          internal_notes: input.internalNotes,
          next_recommended_visit_date: input.nextRecommendedVisitDate,
          after_media_asset_id: input.afterMediaAssetId,
          ...(input.careReportObservations === undefined
            ? {}
            : { care_report_observations: input.careReportObservations }),
          ...(input.careReportVoiceTranscript === undefined
            ? {}
            : { care_report_voice_transcript: input.careReportVoiceTranscript }),
          ...(input.careReportPhotoConsent === undefined
            ? {}
            : { care_report_photo_consent: input.careReportPhotoConsent }),
          created_by_user_id: owner.userId,
          updated_at: now,
        },
        { onConflict: "appointment_id" },
      )
      .select("*")
      .single();
    if (result.error) throw new OwnerApiError(result.error.message, 500);

    return NextResponse.json({ draft: serializeDraft(result.data as DraftRow) });
  } catch (error) {
    return errorResponse(error, "미용 기록을 임시저장하지 못했습니다.");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = (await request.json()) as { shopId?: string; appointmentId?: string };
    const appointmentId = body.appointmentId?.trim() ?? "";
    if (!appointmentId) throw new OwnerApiError("appointmentId가 필요합니다.", 400);

    const owner = await requireOwnerShop(request, body.shopId);
    await requireAppointmentScope(owner, appointmentId);
    const admin = getSupabaseAdmin();
    if (!admin) {
      demoDrafts.delete(draftKey(owner.shopId, appointmentId));
      return NextResponse.json({ deleted: true });
    }

    const result = await admin
      .from("grooming_record_drafts")
      .delete()
      .eq("shop_id", owner.shopId)
      .eq("appointment_id", appointmentId);
    if (result.error) throw new OwnerApiError(result.error.message, 500);

    return NextResponse.json({ deleted: true });
  } catch (error) {
    return errorResponse(error, "미용 기록 임시저장을 정리하지 못했습니다.");
  }
}
