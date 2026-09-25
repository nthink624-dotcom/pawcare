import { NextRequest } from "next/server";
import { z } from "zod";

import {
  buildBasicCareReportText,
  matchesCanonicalCareReportSave,
  normalizeStoredCareReport,
  serializeCareReportSavePayload,
} from "@/lib/care-report-draft";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  assertCareReportTextSafeForSave,
  CareReportGenerationError,
  CareReportSafetyValidationError,
  generateCareReportDraft,
  toSafeCareReportGenerationHttpResponse,
  toSafeCareReportSafetyHttpResponse,
} from "@/server/care-report-ai";
import { hashCareReportSavePayload } from "@/server/care-report-save-identity";
import { OwnerApiError, requireOwnerShop, type OwnerShopContext } from "@/server/owner-api-auth";
import { assertOwnerInitialSetupComplete } from "@/server/owner-initial-setup-guard";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { careReportGenerationInputSchema, careReportTextSchema } from "@/types/care-report";

export const dynamic = "force-dynamic";

const CARE_REPORTS_CORS = { methods: "GET, POST, PATCH, OPTIONS" } as const;

const confirmInputSchema = z.object({
  shopId: z.string().trim().min(1).max(120),
  appointmentId: z.string().trim().min(1).max(120),
  reportText: careReportTextSchema.optional(),
  photoConsent: z.boolean().default(false),
  action: z.enum(["save_draft", "publish", "publish_basic"]).default("publish"),
}).superRefine((value, context) => {
  if (value.action !== "publish_basic" && !value.reportText) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reportText"],
      message: "케어리포트 내용을 확인해 주세요.",
    });
  }
});

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
    return ownerMobileCorsJson(
      request,
      { message: error.status >= 500 ? fallback : error.message },
      { status: error.status },
      CARE_REPORTS_CORS,
    );
  }
  if (error instanceof z.ZodError) {
    return ownerMobileCorsJson(request, { message: "케어리포트 입력 내용을 확인해 주세요." }, { status: 400 }, CARE_REPORTS_CORS);
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

async function buildBasicReportText(appointment: AppointmentScope) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);
  const [petResult, serviceResult, recordResult] = await Promise.all([
    admin.from("pets").select("name").eq("id", appointment.pet_id).eq("shop_id", appointment.shop_id).single(),
    admin.from("services").select("name").eq("id", appointment.service_id).eq("shop_id", appointment.shop_id).single(),
    admin.from("grooming_records").select("service_name_snapshot").eq("appointment_id", appointment.id).eq("shop_id", appointment.shop_id).maybeSingle(),
  ]);
  if (petResult.error) throw new OwnerApiError(petResult.error.message, 500);
  if (serviceResult.error) throw new OwnerApiError(serviceResult.error.message, 500);
  if (recordResult.error) throw new OwnerApiError(recordResult.error.message, 500);
  return buildBasicCareReportText(
    String(petResult.data.name ?? ""),
    String(recordResult.data?.service_name_snapshot ?? serviceResult.data.name ?? ""),
  );
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, request.nextUrl.searchParams.get("shopId") ?? undefined);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("데이터베이스 서버 설정을 확인해 주세요.", 503);
    const result = await admin
      .from("grooming_record_drafts")
      .select("id,appointment_id,pet_id,care_report_ai_draft,care_report_owner_confirmed_at,care_report_photo_consent,updated_at")
      .eq("shop_id", owner.shopId)
      .order("updated_at", { ascending: false })
      .limit(200);
    if (result.error) throw new OwnerApiError(result.error.message, 500);
    const visibleRows = owner.role === "staff"
      ? (await Promise.all((result.data ?? []).map(async (row) => {
          await requireAppointmentScope(owner, row.appointment_id);
          return row;
        })))
      : result.data ?? [];
    const drafts = visibleRows.map((row) => ({
      id: row.id,
      appointmentId: row.appointment_id,
      petId: row.pet_id,
      reportText: normalizeStoredCareReport(row.care_report_ai_draft)?.reportText ?? null,
      ownerConfirmedAt: row.care_report_owner_confirmed_at,
      photoConsent: row.care_report_photo_consent,
      updatedAt: row.updated_at,
    }));
    return ownerMobileCorsJson(request, { drafts }, { headers: { "Cache-Control": "private, no-store, max-age=0" } }, CARE_REPORTS_CORS);
  } catch (error) {
    return errorResponse(request, error, "케어리포트 목록을 불러오지 못했습니다. 다시 시도해 주세요.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const input = careReportGenerationInputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    await assertOwnerInitialSetupComplete(owner.shopId);
    await requireAppointmentScope(owner, input.appointmentId);
    const generated = await generateCareReportDraft({
      sourceText: input.sourceText,
      currentReportText: input.currentReportText,
      revisionRequest: input.revisionRequest,
    });
    return ownerMobileCorsJson(
      request,
      { reportText: generated.reportText },
      { headers: { "Cache-Control": "no-store" } },
      CARE_REPORTS_CORS,
    );
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

    const [draftLookup, finalLookup] = await Promise.all([
      admin.from("grooming_record_drafts").select("care_report_ai_draft,care_report_photo_consent").eq("shop_id", owner.shopId).eq("appointment_id", appointment.id).maybeSingle(),
      admin.from("grooming_records").select("id,care_report_data").eq("shop_id", owner.shopId).eq("appointment_id", appointment.id).maybeSingle(),
    ]);
    if (draftLookup.error) throw new OwnerApiError(draftLookup.error.message, 500);
    if (finalLookup.error) throw new OwnerApiError(finalLookup.error.message, 500);

    const reportText = input.action === "publish_basic" ? await buildBasicReportText(appointment) : input.reportText;
    if (!reportText) throw new OwnerApiError("케어리포트 내용을 확인해 주세요.", 400);
    assertCareReportTextSafeForSave(reportText);

    if (input.action === "save_draft") {
      const savePayloadFingerprint = hashCareReportSavePayload(serializeCareReportSavePayload({ reportText, photoConsent: input.photoConsent }));
      const existing = normalizeStoredCareReport(draftLookup.data?.care_report_ai_draft);
      if (existing && matchesCanonicalCareReportSave({
        expected: { reportText, photoConsent: input.photoConsent },
        actual: { reportText: existing.reportText, photoConsent: Boolean(draftLookup.data?.care_report_photo_consent) },
      })) {
        return ownerMobileCorsJson(request, {
          status: "draft",
          reportText,
          savePayloadFingerprint,
          idempotent: true,
        }, { headers: { "Cache-Control": "private, no-store, max-age=0" } }, CARE_REPORTS_CORS);
      }
      const savedAt = new Date().toISOString();
      const update = await admin.from("grooming_record_drafts").upsert({
        shop_id: owner.shopId,
        appointment_id: appointment.id,
        guardian_id: appointment.guardian_id,
        pet_id: appointment.pet_id,
        care_report_ai_draft: { reportText },
        care_report_observations: {},
        care_report_voice_transcript: "",
        care_report_generation_id: null,
        care_report_photo_consent: input.photoConsent,
        care_report_owner_confirmed_at: null,
        created_by_user_id: owner.userId,
        updated_at: savedAt,
      }, { onConflict: "appointment_id" });
      if (update.error) throw new OwnerApiError(update.error.message, 500);
      return ownerMobileCorsJson(request, { status: "draft", savedAt, reportText, savePayloadFingerprint }, undefined, CARE_REPORTS_CORS);
    }

    if (!finalLookup.data) {
      throw new OwnerApiError("미용 완료 기록이 만들어진 뒤 케어리포트를 보낼 수 있습니다.", 409);
    }
    if (input.action === "publish" && !draftLookup.data?.care_report_ai_draft && !finalLookup.data.care_report_data) {
      throw new OwnerApiError("먼저 케어리포트 초안을 저장해 주세요.", 409);
    }
    const confirmedAt = new Date().toISOString();
    const publishResult = await admin.rpc("publish_ai_care_report", {
      p_shop_id: owner.shopId,
      p_appointment_id: appointment.id,
      p_care_report: { reportText },
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
      reportText,
    }, undefined, CARE_REPORTS_CORS);
  } catch (error) {
    return errorResponse(request, error, "케어리포트를 저장하지 못했습니다. 입력한 내용은 유지되었어요. 다시 시도해 주세요.");
  }
}

export async function OPTIONS(request: NextRequest) {
  return ownerMobileCorsPreflight(request, CARE_REPORTS_CORS);
}
