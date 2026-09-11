import { NextRequest } from "next/server";
import { z } from "zod";

import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readCurrentVisitWeightForCompletion } from "@/server/appointment-visit-weight";
import {
  assertCareReportDraftPiiFree,
  CareReportGenerationError,
  CareReportSafetyValidationError,
  generateCareReportDraft,
  toSafeCareReportGenerationHttpResponse,
  toSafeCareReportSafetyHttpResponse,
} from "@/server/care-report-ai";
import { decideCareReportSaveReplay, hashCareReportSavePayload } from "@/server/care-report-save-identity";
import {
  buildPreviewCareReportDraft,
  prepareCareReportSourceText,
  sanitizeCareReportObservations,
  serializeCareReportSavePayload,
} from "@/lib/care-report-draft";
import { OwnerApiError, requireOwnerShop, type OwnerShopContext } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import {
  careReportDraftSchema,
  careReportGenerationInputSchema,
  careReportObservationsSchema,
  type CareReportDraft,
} from "@/types/care-report";

export const dynamic = "force-dynamic";

const CARE_REPORTS_CORS = { methods: "GET, POST, PATCH, OPTIONS" } as const;

const confirmInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  careReport: careReportDraftSchema.optional(),
  careReportObservations: careReportObservationsSchema.optional(),
  careReportSourceText: z.string().trim().max(1000).optional(),
  saveRequestId: z.string().trim().regex(/^save-[a-z0-9-]{1,64}$/).optional(),
  photoConsent: z.boolean().default(false),
  action: z.enum(["save_draft", "publish", "publish_basic"]).default("publish"),
}).superRefine((value, context) => {
  if (value.action !== "publish_basic" && !value.careReport) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["careReport"],
      message: "케어리포트 내용을 확인해 주세요.",
    });
  }
});

const emptyCareReportObservations = {
  coat: [],
  skin: [],
  ears: [],
  pawsAndNails: [],
  groomingResponse: [],
  customNote: "",
  sourceFacts: [],
  sourceFactCitations: [],
};

async function buildBasicCareReport(appointment: AppointmentScope): Promise<CareReportDraft> {
  const context = await readCareReportContext(appointment);
  return buildPreviewCareReportDraft({
    petName: context.petName,
    serviceName: context.serviceName,
    actualDurationMinutes: context.automaticFacts.actualDurationMinutes,
    nextRecommendedVisitDate: context.automaticFacts.nextRecommendedVisitDate,
    ownerSourceText: "",
    observations: emptyCareReportObservations,
  });
}

type AppointmentScope = {
  id: string;
  shop_id: string;
  guardian_id: string;
  pet_id: string;
  service_id: string;
  staff_id: string | null;
};

function errorResponse(request: NextRequest, error: unknown, fallback: string) {
  if (error instanceof CareReportSafetyValidationError) {
    const diagnostic = toSafeCareReportSafetyHttpResponse(error);
    return ownerMobileCorsJson(request, diagnostic.body, { status: diagnostic.status }, CARE_REPORTS_CORS);
  }
  if (error instanceof CareReportGenerationError) {
    const diagnostic = toSafeCareReportGenerationHttpResponse(error);
    return ownerMobileCorsJson(request, diagnostic.body, { status: diagnostic.status }, CARE_REPORTS_CORS);
  }
  if (error instanceof OwnerApiError) {
    const message = error.status >= 500 ? fallback : error.message;
    return ownerMobileCorsJson(request, { message }, { status: error.status }, CARE_REPORTS_CORS);
  }
  if (error instanceof z.ZodError) {
    return ownerMobileCorsJson(
      request,
      { message: "케어리포트 입력 내용을 확인해 주세요." },
      { status: 400 },
      CARE_REPORTS_CORS,
    );
  }
  return ownerMobileCorsJson(request, { message: fallback }, { status: 500 }, CARE_REPORTS_CORS);
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

  const [petResult, serviceResult, currentRecordResult, weightHistoryResult, currentVisitWeight] = await Promise.all([
    admin.from("pets").select("name,breed,weight").eq("id", appointment.pet_id).eq("shop_id", appointment.shop_id).single(),
    admin.from("services").select("name,duration_minutes").eq("id", appointment.service_id).eq("shop_id", appointment.shop_id).single(),
    admin
      .from("grooming_records")
      .select("id,actual_duration_minutes,expected_duration_minutes,pet_weight_snapshot,next_recommended_visit_date,service_name_snapshot")
      .eq("appointment_id", appointment.id)
      .eq("shop_id", appointment.shop_id)
      .maybeSingle(),
    admin
      .from("grooming_records")
      .select("id,pet_weight_snapshot,groomed_at")
      .eq("pet_id", appointment.pet_id)
      .eq("shop_id", appointment.shop_id)
      .gt("pet_weight_snapshot", 0)
      .order("groomed_at", { ascending: false })
      .limit(12),
    readCurrentVisitWeightForCompletion(appointment.shop_id, appointment.id),
  ]);
  if (petResult.error) throw new OwnerApiError(petResult.error.message, 500);
  if (serviceResult.error) throw new OwnerApiError(serviceResult.error.message, 500);
  if (currentRecordResult.error) throw new OwnerApiError(currentRecordResult.error.message, 500);
  if (weightHistoryResult.error) throw new OwnerApiError(weightHistoryResult.error.message, 500);

  const currentRecord = currentRecordResult.data;
  const normalizeWeight = (value: unknown) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? Math.round(numeric * 10) / 10 : null;
  };
  const currentWeightKg = normalizeWeight(currentVisitWeight?.weightKg ?? currentRecord?.pet_weight_snapshot);
  const priorWeights = (weightHistoryResult.data ?? [])
    .filter((item) => item.id !== currentRecord?.id)
    .map((item) => normalizeWeight(item.pet_weight_snapshot))
    .filter((value): value is number => value !== null);
  const recentAverageWeightKg = priorWeights.length > 0
    ? Math.round((priorWeights.reduce((sum, value) => sum + value, 0) / priorWeights.length) * 10) / 10
    : null;
  const weightChangeFromPreviousKg = currentWeightKg !== null && priorWeights[0] !== undefined
    ? Math.round((currentWeightKg - priorWeights[0]) * 10) / 10
    : null;
  const weightDifferenceFromRecentAverageKg = currentWeightKg !== null && recentAverageWeightKg !== null
    ? Math.round((currentWeightKg - recentAverageWeightKg) * 10) / 10
    : null;

  return {
    petName: petResult.data.name as string,
    petBreed: (petResult.data.breed as string | null) ?? "",
    serviceName: (currentRecord?.service_name_snapshot as string | null) || (serviceResult.data.name as string),
    automaticFacts: {
      actualDurationMinutes: (currentRecord?.actual_duration_minutes as number | null) ?? null,
      expectedDurationMinutes:
        (currentRecord?.expected_duration_minutes as number | null) ??
        (serviceResult.data.duration_minutes as number | null) ??
        null,
      currentWeightKg,
      previousWeightKg: priorWeights[0] ?? null,
      weightChangeFromPreviousKg,
      recentAverageWeightKg,
      weightDifferenceFromRecentAverageKg,
      weightSampleCount: priorWeights.length,
      nextRecommendedVisitDate: (currentRecord?.next_recommended_visit_date as string | null) ?? null,
    },
  };
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

    return ownerMobileCorsJson(
      request,
      { drafts },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
      CARE_REPORTS_CORS,
    );
  } catch (error) {
    return errorResponse(request, error, "케어리포트 목록을 불러오지 못했습니다. 다시 시도해 주세요.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = careReportGenerationInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const appointment = await requireAppointmentScope(owner, input.appointmentId);
    const contextBase = await readCareReportContext(appointment);
    const observations = sanitizeCareReportObservations(input.observations);
    const context = {
      ...contextBase,
      observations,
      voiceTranscript: prepareCareReportSourceText(input.voiceTranscript),
      currentDraft: input.currentDraft,
    };
    const generated = await generateCareReportDraft(context);

    return ownerMobileCorsJson(request, {
      generationId: input.clientGenerationId ?? `generation-preview-${generated.inputHash.slice(0, 24)}`,
      status: "preview",
      careReport: generated.draft,
      sourceFactCitations: generated.sourceFactCitations,
      generation: {
        schemaVersion: "care-report-v2",
        promptVersion: "care-report-facts-v2",
        model: generated.model,
        generationId: input.clientGenerationId ?? `generation-preview-${generated.inputHash.slice(0, 24)}`,
        inputHash: generated.inputHash,
      },
      usage: generated.usage,
      estimatedCostUsd: generated.estimatedCostUsd,
    }, { headers: { "Cache-Control": "no-store" } }, CARE_REPORTS_CORS);
  } catch (error) {
    return errorResponse(request, error, "AI 케어리포트 초안을 만들지 못했습니다. 입력한 내용은 유지되었어요. 다시 시도해 주세요.");
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const input = confirmInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);
    const appointment = await requireAppointmentScope(owner, input.appointmentId);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);

    const confirmedAt = new Date().toISOString();
    const draftLookup = await admin
      .from("grooming_record_drafts")
      .select("care_report_ai_draft,care_report_generation_id,care_report_observations,care_report_voice_transcript")
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

    if (input.action === "publish" && !draftLookup.data?.care_report_ai_draft && !finalLookup.data?.care_report_data) {
      throw new OwnerApiError("먼저 AI 초안을 만들어 주세요.", 409);
    }

    const careReport = input.action === "publish_basic"
      ? await buildBasicCareReport(appointment)
      : input.careReport;
    if (!careReport) throw new OwnerApiError("케어리포트 내용을 확인해 주세요.", 400);
    assertCareReportDraftPiiFree(careReport);

    if (input.action === "save_draft") {
      const sourceText = input.careReportSourceText === undefined
        ? draftLookup.data?.care_report_voice_transcript ?? ""
        : prepareCareReportSourceText(input.careReportSourceText);
      const normalizedObservations = input.careReportObservations
        ? sanitizeCareReportObservations(input.careReportObservations)
        : careReportObservationsSchema.parse(draftLookup.data?.care_report_observations ?? emptyCareReportObservations);
      const savePayloadFingerprint = hashCareReportSavePayload(serializeCareReportSavePayload({
        careReport,
        observations: normalizedObservations,
        sourceText,
        photoConsent: input.photoConsent,
      }));
      const saveRequestId = input.saveRequestId ?? `save-mobile-${savePayloadFingerprint.slice(0, 24)}`;
      const existingObservations = careReportObservationsSchema.safeParse(draftLookup.data?.care_report_observations);
      const existingRequestId = existingObservations.success ? existingObservations.data.saveRequestId : undefined;
      const existingFingerprint = existingObservations.success ? existingObservations.data.savePayloadFingerprint : undefined;
      const replayDecision = decideCareReportSaveReplay({
        requestId: saveRequestId,
        fingerprint: savePayloadFingerprint,
        existingRequestId,
        existingFingerprint,
      });
      if (replayDecision === "conflict") {
          throw new OwnerApiError("같은 저장 요청의 내용이 달라 저장하지 않았습니다. 내용을 확인한 뒤 다시 저장해 주세요.", 409);
      }
      if (replayDecision === "replay") {
        return ownerMobileCorsJson(request, {
          status: "draft",
          savedAt: new Date().toISOString(),
          careReport,
          savePayloadFingerprint,
          idempotent: true,
        }, {
          headers: { "Cache-Control": "private, no-store, max-age=0" },
        }, CARE_REPORTS_CORS);
      }

      const persistedObservations = careReportObservationsSchema.parse({
        ...normalizedObservations,
        saveRequestId,
        savePayloadFingerprint,
      });

      const savedAt = new Date().toISOString();
      const draftUpdate = await admin
        .from("grooming_record_drafts")
        .upsert({
          shop_id: owner.shopId,
          appointment_id: appointment.id,
          guardian_id: appointment.guardian_id,
          pet_id: appointment.pet_id,
          care_report_ai_draft: careReport,
          care_report_observations: persistedObservations,
          care_report_voice_transcript: sourceText,
          care_report_photo_consent: input.photoConsent,
          care_report_owner_confirmed_at: null,
          created_by_user_id: owner.userId,
          updated_at: savedAt,
        }, { onConflict: "appointment_id" });
      if (draftUpdate.error) throw new OwnerApiError(draftUpdate.error.message, 500);

      return ownerMobileCorsJson(
        request,
        { status: "draft", savedAt, careReport, savePayloadFingerprint },
        undefined,
        CARE_REPORTS_CORS,
      );
    }

    if (!finalLookup.data) {
      throw new OwnerApiError("미용 완료 기록이 만들어진 뒤 케어리포트를 보낼 수 있습니다.", 409);
    }

    const publishResult = await admin.rpc("publish_ai_care_report", {
      p_shop_id: owner.shopId,
      p_appointment_id: appointment.id,
      p_care_report: careReport,
      p_photo_consent: input.photoConsent,
      p_confirmed_at: confirmedAt,
    });
    if (publishResult.error) {
      if (publishResult.error.message.includes("CARE_REPORT_FINAL_RECORD_MISSING")) {
        throw new OwnerApiError("미용 완료 기록이 만들어진 뒤 케어리포트를 보낼 수 있습니다.", 409);
      }
      throw new OwnerApiError(publishResult.error.message, 500);
    }

    return ownerMobileCorsJson(request, {
      status: input.action === "publish_basic" ? "published_basic" : "published",
      confirmedAt,
      careReport,
    }, undefined, CARE_REPORTS_CORS);
  } catch (error) {
    return errorResponse(request, error, "케어리포트를 저장하지 못했습니다. 입력한 내용은 유지되었어요. 다시 시도해 주세요.");
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, CARE_REPORTS_CORS);
}
