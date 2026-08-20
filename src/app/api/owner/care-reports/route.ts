import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  generateCareReportDraft,
  hashCareReportInput,
} from "@/server/care-report-ai";
import { OwnerApiError, requireOwnerShop, type OwnerShopContext } from "@/server/owner-api-auth";
import {
  careReportDraftSchema,
  careReportGenerationInputSchema,
} from "@/types/care-report";

export const dynamic = "force-dynamic";

const confirmInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  careReport: careReportDraftSchema,
  photoConsent: z.boolean(),
});

type AppointmentScope = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  service_id: string;
  staff_id: string | null;
};

function errorResponse(error: unknown, fallback: string) {
  if (error instanceof OwnerApiError) {
    return NextResponse.json({ message: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ message: "케어리포트 입력 내용을 확인해 주세요." }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ message }, { status: 500 });
}

async function requireAppointmentScope(owner: OwnerShopContext, appointmentId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

  const result = await admin
    .from("appointments")
    .select("id,shop_id,guardian_id,pet_id,service_id,staff_id")
    .eq("id", appointmentId)
    .eq("shop_id", owner.shopId)
    .maybeSingle();
  if (result.error) throw new OwnerApiError(result.error.message, 500);
  if (!result.data) throw new OwnerApiError("케어리포트를 작성할 예약을 찾지 못했습니다.", 404);

  const appointment = result.data as AppointmentScope;
  if (owner.role === "staff" && appointment.staff_id !== owner.staffId) {
    throw new OwnerApiError("본인 담당 예약의 케어리포트만 작성할 수 있습니다.", 403);
  }
  return appointment;
}

async function readCareReportContext(appointment: AppointmentScope) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

  const [petResult, serviceResult] = await Promise.all([
    admin.from("pets").select("name,breed").eq("id", appointment.pet_id).eq("shop_id", appointment.shop_id).single(),
    admin.from("services").select("name").eq("id", appointment.service_id).eq("shop_id", appointment.shop_id).single(),
  ]);
  if (petResult.error) throw new OwnerApiError(petResult.error.message, 500);
  if (serviceResult.error) throw new OwnerApiError(serviceResult.error.message, 500);

  return {
    petName: petResult.data.name as string,
    petBreed: (petResult.data.breed as string | null) ?? "",
    serviceName: serviceResult.data.name as string,
  };
}

function generationErrorCode(error: unknown) {
  if (error instanceof z.ZodError || error instanceof SyntaxError) return "invalid_ai_json";
  if (error instanceof Error && error.name === "AbortError") return "provider_timeout";
  if (error instanceof Error && error.message.includes("의료 진단")) return "medical_copy_blocked";
  return "provider_error";
}

export async function GET(request: NextRequest) {
  try {
    const shopId = request.nextUrl.searchParams.get("shopId") ?? undefined;
    const owner = await requireOwnerShop(request, shopId);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

    const result = await admin
      .from("grooming_record_drafts")
      .select("id,appointment_id,pet_id,care_report_observations,care_report_ai_draft,care_report_generation_id,care_report_owner_confirmed_at,care_report_photo_consent,updated_at")
      .eq("shop_id", owner.shopId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (result.error) throw new OwnerApiError(result.error.message, 500);

    const drafts = owner.role === "staff"
      ? (await Promise.all((result.data ?? []).map(async (draft) => {
          const scope = await requireAppointmentScope(owner, draft.appointment_id);
          return scope ? draft : null;
        }))).filter(Boolean)
      : result.data ?? [];

    return NextResponse.json(
      { drafts },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    return errorResponse(error, "케어리포트 목록을 불러오지 못했습니다.");
  }
}

export async function POST(request: NextRequest) {
  let generationId: string | null = null;
  try {
    const input = careReportGenerationInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    const appointment = await requireAppointmentScope(owner, input.appointmentId);
    const contextBase = await readCareReportContext(appointment);
    const context = {
      ...contextBase,
      observations: input.observations,
      voiceTranscript: input.voiceTranscript,
    };
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

    const now = new Date().toISOString();
    const draftResult = await admin
      .from("grooming_record_drafts")
      .upsert(
        {
          shop_id: owner.shopId,
          appointment_id: appointment.id,
          guardian_id: appointment.guardian_id,
          pet_id: appointment.pet_id,
          care_report_observations: input.observations,
          care_report_voice_transcript: input.voiceTranscript,
          care_report_photo_consent: input.photoConsent,
          care_report_owner_confirmed_at: null,
          created_by_user_id: owner.userId,
          updated_at: now,
        },
        { onConflict: "appointment_id" },
      )
      .select("id")
      .single();
    if (draftResult.error) throw new OwnerApiError(draftResult.error.message, 500);

    const inputHash = hashCareReportInput(serverEnv.deepseekModel, context);
    const pendingGeneration = await admin
      .from("ai_care_report_generations")
      .insert({
        shop_id: owner.shopId,
        appointment_id: appointment.id,
        draft_id: draftResult.data.id,
        created_by_user_id: owner.userId,
        model: serverEnv.deepseekModel,
        input_hash: inputHash,
        status: "pending",
      })
      .select("id")
      .single();
    if (pendingGeneration.error) throw new OwnerApiError(pendingGeneration.error.message, 500);
    generationId = pendingGeneration.data.id;

    const generated = await generateCareReportDraft(context);
    const completedAt = new Date().toISOString();
    const generationUpdate = await admin
      .from("ai_care_report_generations")
      .update({
        result: generated.draft,
        token_usage: generated.usage,
        estimated_cost_usd: generated.estimatedCostUsd,
        status: "complete",
        completed_at: completedAt,
      })
      .eq("id", generationId)
      .eq("shop_id", owner.shopId);
    if (generationUpdate.error) throw new OwnerApiError(generationUpdate.error.message, 500);

    const saveDraft = await admin
      .from("grooming_record_drafts")
      .update({
        care_report_ai_draft: generated.draft,
        care_report_generation_id: generationId,
        care_report_owner_confirmed_at: null,
        updated_at: completedAt,
      })
      .eq("id", draftResult.data.id)
      .eq("shop_id", owner.shopId);
    if (saveDraft.error) throw new OwnerApiError(saveDraft.error.message, 500);

    return NextResponse.json({
      generationId,
      status: "draft",
      careReport: generated.draft,
      usage: generated.usage,
      estimatedCostUsd: generated.estimatedCostUsd,
    });
  } catch (error) {
    if (generationId) {
      const admin = getSupabaseAdmin();
      await admin
        ?.from("ai_care_report_generations")
        .update({
          status: "error",
          error_code: generationErrorCode(error),
          completed_at: new Date().toISOString(),
        })
        .eq("id", generationId);
    }
    return errorResponse(error, "AI 케어리포트 초안을 만들지 못했습니다.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = confirmInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    const appointment = await requireAppointmentScope(owner, input.appointmentId);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

    const confirmedAt = new Date().toISOString();
    const draftLookup = await admin
      .from("grooming_record_drafts")
      .select("care_report_ai_draft,care_report_generation_id,care_report_observations")
      .eq("shop_id", owner.shopId)
      .eq("appointment_id", appointment.id)
      .maybeSingle();
    if (draftLookup.error) throw new OwnerApiError(draftLookup.error.message, 500);

    const finalLookup = await admin
      .from("grooming_records")
      .select("id,care_report_data,care_report_generation_id,care_report_observations")
      .eq("shop_id", owner.shopId)
      .eq("appointment_id", appointment.id)
      .maybeSingle();
    if (finalLookup.error) throw new OwnerApiError(finalLookup.error.message, 500);

    if (!draftLookup.data?.care_report_ai_draft && !finalLookup.data?.care_report_data) {
      throw new OwnerApiError("먼저 AI 초안을 만들어 주세요.", 409);
    }

    if (draftLookup.data) {
      const draftUpdate = await admin
        .from("grooming_record_drafts")
        .update({
          care_report_ai_draft: input.careReport,
          care_report_photo_consent: input.photoConsent,
          care_report_owner_confirmed_at: confirmedAt,
          updated_at: confirmedAt,
        })
        .eq("shop_id", owner.shopId)
        .eq("appointment_id", appointment.id);
      if (draftUpdate.error) throw new OwnerApiError(draftUpdate.error.message, 500);
    }

    if (finalLookup.data) {
      const finalRecordUpdate = await admin
        .from("grooming_records")
        .update({
          care_report_data: input.careReport,
          care_report_observations: draftLookup.data?.care_report_observations ?? finalLookup.data.care_report_observations,
          care_report_generation_id: draftLookup.data?.care_report_generation_id ?? finalLookup.data.care_report_generation_id,
          care_report_photo_consent: input.photoConsent,
          care_report_owner_confirmed_at: confirmedAt,
          updated_at: confirmedAt,
        })
        .eq("shop_id", owner.shopId)
        .eq("appointment_id", appointment.id);
      if (finalRecordUpdate.error) throw new OwnerApiError(finalRecordUpdate.error.message, 500);
    }

    if (finalLookup.data && draftLookup.data) {
      const cleanup = await admin
        .from("grooming_record_drafts")
        .delete()
        .eq("shop_id", owner.shopId)
        .eq("appointment_id", appointment.id);
      if (cleanup.error) throw new OwnerApiError(cleanup.error.message, 500);
    }

    return NextResponse.json({ status: "confirmed", confirmedAt, careReport: input.careReport });
  } catch (error) {
    return errorResponse(error, "케어리포트 확인 상태를 저장하지 못했습니다.");
  }
}
