import { randomBytes } from "node:crypto";
import { z } from "zod";
import type { NextRequest } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";

export const dynamic = "force-dynamic";

const templateSchema = z.object({
  shopId: z.string().trim().min(1).max(100),
  notificationType: z.enum([
    "booking_confirmed", "booking_cancelled", "appointment_reminder_10m",
    "visit_schedule_notice", "visit_reminder_notice", "grooming_started",
    "grooming_almost_done", "grooming_completed",
  ]),
  templateName: z.string().trim().min(1).max(100),
  templateContent: z.string().trim().min(1).max(1000),
  categoryCode: z.string().trim().min(1).max(100),
  buttonName: z.string().trim().max(14).optional().default(""),
  buttonUrl: z.string().trim().max(2000).optional().default(""),
  action: z.enum(["save", "submit"]),
  id: z.string().uuid().optional(),
}).superRefine((value, context) => {
  const allowedVariables = new Set([
    "매장명", "반려동물명", "보호자명", "예약일시", "제안일시", "서비스명", "매장주소",
    "예약 링크", "예약 확인 링크", "예약관리링크", "예약관리토큰", "예약시간변경링크",
    "예약시간변경토큰", "bookingRescheduleToken", "bookingRescheduleUrl", "길찾기링크",
    "방문전알림분", "방문전알림안내", "픽업예상분", "픽업예상시간", "픽업안내",
    "pickupReadyEtaMinutes", "pickupGuide",
  ]);
  const unknownVariables = Array.from(value.templateContent.matchAll(/#\{([^}]+)\}/g))
    .map((match) => match[1]?.trim() ?? "")
    .filter((variable) => variable && !allowedVariables.has(variable));
  if (unknownVariables.length > 0) {
    context.addIssue({ code: "custom", path: ["templateContent"], message: "사용할 수 없는 자동 입력 항목이 있습니다." });
  }
  const buttonRequiredTypes = new Set([
    "booking_confirmed", "appointment_reminder_10m", "visit_schedule_notice",
    "visit_reminder_notice", "grooming_completed",
  ]);
  if (Boolean(value.buttonName) !== Boolean(value.buttonUrl)) {
    context.addIssue({ code: "custom", path: ["buttonUrl"], message: "버튼 이름과 링크를 함께 입력해 주세요." });
  }
  if (buttonRequiredTypes.has(value.notificationType) && (!value.buttonName || !value.buttonUrl)) {
    context.addIssue({ code: "custom", path: ["buttonUrl"], message: "이 알림 검수에 필요한 버튼 링크를 입력해 주세요." });
  }
  if (value.buttonUrl) {
    try {
      if (new URL(value.buttonUrl).protocol !== "https:") throw new Error("https required");
    } catch {
      context.addIssue({ code: "custom", path: ["buttonUrl"], message: "https 링크를 입력해 주세요." });
    }
  }
});

function relayUrl(path: string) {
  const base = serverEnv.alimtalkRelayAdminUrl || serverEnv.alimtalkRelayUrl;
  if (!base || !serverEnv.alimtalkRelaySecret) return null;
  const url = new URL(base);
  url.pathname = path;
  url.search = "";
  url.hash = "";
  return url.toString();
}

async function callRelay(path: string, method = "GET", payload?: unknown) {
  const url = relayUrl(path);
  if (!url) throw new OwnerApiError("알림톡 템플릿 서버 연결을 확인해 주세요.", 503);
  const response = await fetch(url, {
    method,
    headers: {
      "x-relay-secret": serverEnv.alimtalkRelaySecret ?? "",
      ...(payload ? { "content-type": "application/json" } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
    cache: "no-store",
  });
  if (!response.ok) throw new OwnerApiError("템플릿 검수 요청을 보내지 못했습니다.", 502);
  return await response.json() as Record<string, unknown>;
}

function inspectionState(value: unknown) {
  const status = String(value ?? "").toUpperCase();
  if (["APR", "APPROVED", "COMPLETE"].includes(status)) return "approved";
  if (["REJ", "REJECTED"].includes(status)) return "rejected";
  if (["ING", "REVIEWING", "PROCESSING"].includes(status)) return "reviewing";
  if (["REQ", "REQUESTED", "WAIT", "WAITING"].includes(status)) return "requested";
  return "unknown";
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const owner = await requireOwnerShop(request, url.searchParams.get("shopId") || undefined);
    assertOwnerOrManager(owner);
    const admin = getSupabaseAdmin();
    if (!admin) throw new OwnerApiError("템플릿 저장 설정을 확인해 주세요.", 503);

    const [rowsResult, categoriesResult, catalogResult] = await Promise.all([
      admin.from("shop_alimtalk_template_requests").select("*").eq("shop_id", owner.shopId).order("created_at", { ascending: false }),
      callRelay("/admin/templates/categories").catch(() => null),
      callRelay("/admin/templates").catch(() => null),
    ]);
    if (rowsResult.error) throw new OwnerApiError("매장 템플릿을 불러오지 못했습니다.", 503);

    const catalog = Array.isArray(catalogResult?.allTemplates) ? catalogResult.allTemplates as Array<Record<string, unknown>> : [];
    const rows = (rowsResult.data ?? []) as Array<Record<string, unknown>>;
    const synced = await Promise.all(rows.map(async (row) => {
      const provider = catalog.find((item) => item.templateCode === row.template_code);
      if (!provider || row.inspection_status === "draft") return row;
      const serviceStatus = String(provider.serviceStatus ?? "unknown").toLowerCase();
      const nextStatus = ["act", "rdy", "active", "ready"].includes(serviceStatus)
        ? "approved"
        : inspectionState(provider.inspectionStatus);
      if (nextStatus === row.inspection_status && serviceStatus === row.service_status) return row;
      const update = await admin.from("shop_alimtalk_template_requests").update({
        inspection_status: nextStatus,
        service_status: serviceStatus,
        provider_checked_at: new Date().toISOString(),
      }).eq("id", String(row.id)).eq("shop_id", owner.shopId).select("*").maybeSingle();
      return update.data ?? row;
    }));

    const categories = Array.isArray(categoriesResult?.categories) ? categoriesResult.categories : [];
    return Response.json({ templates: synced, categories });
  } catch (error) {
    const status = error instanceof OwnerApiError ? error.status : 500;
    return Response.json({ message: error instanceof OwnerApiError ? error.message : "매장 템플릿을 불러오지 못했습니다." }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = templateSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, payload.shopId);
    assertOwnerOrManager(owner);
    const admin = getSupabaseAdmin();
    if (!admin || !owner.userId) throw new OwnerApiError("템플릿 저장 설정을 확인해 주세요.", 503);

    let row: Record<string, unknown> | null = null;
    if (payload.id) {
      const current = await admin.from("shop_alimtalk_template_requests").select("*").eq("id", payload.id).eq("shop_id", owner.shopId).maybeSingle();
      if (current.error || !current.data) throw new OwnerApiError("저장할 템플릿을 찾지 못했습니다.", 404);
      if (current.data.notification_type !== payload.notificationType) throw new OwnerApiError("템플릿 알림 종류를 확인해 주세요.", 409);
      if (current.data.inspection_status !== "draft") throw new OwnerApiError("심사 요청된 템플릿은 수정할 수 없습니다. 새 템플릿으로 작성해 주세요.", 409);
      const updated = await admin.from("shop_alimtalk_template_requests").update({
        template_name: payload.templateName,
        template_content: payload.templateContent,
        category_code: payload.categoryCode,
        template_buttons: payload.buttonName && payload.buttonUrl
          ? [{ buttonType: "WL", buttonName: payload.buttonName, linkMobile: payload.buttonUrl, linkPc: payload.buttonUrl }]
          : [],
        updated_at: new Date().toISOString(),
      }).eq("id", payload.id).eq("shop_id", owner.shopId).select("*").single();
      if (updated.error) throw new OwnerApiError("템플릿 초안을 저장하지 못했습니다.", 503);
      row = updated.data;
    } else {
      const templateCode = `PM${randomBytes(13).toString("hex").toUpperCase()}`;
      const inserted = await admin.from("shop_alimtalk_template_requests").insert({
        shop_id: owner.shopId,
        notification_type: payload.notificationType,
        template_code: templateCode,
        template_name: payload.templateName,
        template_content: payload.templateContent,
        category_code: payload.categoryCode,
        template_buttons: payload.buttonName && payload.buttonUrl
          ? [{ buttonType: "WL", buttonName: payload.buttonName, linkMobile: payload.buttonUrl, linkPc: payload.buttonUrl }]
          : [],
        created_by_user_id: owner.userId,
      }).select("*").single();
      if (inserted.error) throw new OwnerApiError("템플릿 초안을 저장하지 못했습니다.", 503);
      row = inserted.data;
    }

    if (!row) throw new OwnerApiError("템플릿 초안을 저장하지 못했습니다.", 503);

    if (payload.action === "submit") {
      const templateRowId = String(row.id);
      const activeRequest = await admin
        .from("shop_alimtalk_template_requests")
        .select("id")
        .eq("shop_id", owner.shopId)
        .eq("notification_type", payload.notificationType)
        .in("inspection_status", ["submitting", "requested", "reviewing", "unknown"])
        .neq("id", templateRowId)
        .limit(1)
        .maybeSingle();
      if (activeRequest.error) throw new OwnerApiError("기존 검수 요청 상태를 확인하지 못했습니다.", 503);
      if (activeRequest.data) throw new OwnerApiError("이 알림은 이미 검수 중입니다. 기존 요청 결과를 확인한 뒤 다시 요청해 주세요.", 409);
      const submitting = await admin.from("shop_alimtalk_template_requests").update({ inspection_status: "submitting" }).eq("id", templateRowId).eq("shop_id", owner.shopId).eq("inspection_status", "draft").select("*").maybeSingle();
      if (submitting.error || !submitting.data) throw new OwnerApiError("이 템플릿은 이미 검수 요청 중입니다.", 409);
      row = submitting.data;
      if (!row) throw new OwnerApiError("템플릿 요청 상태를 확인하지 못했습니다.", 503);
      try {
        await callRelay("/admin/templates/register", "POST", {
          templateCode: row.template_code,
          templateName: row.template_name,
          templateContent: row.template_content,
          categoryCode: row.category_code,
          templateMessageType: "BA",
          templateEmphasizeType: "NONE",
          templateConfigKey: null,
          templateButtons: Array.isArray(row.template_buttons) ? row.template_buttons : [],
          comment: `${payload.notificationType} 알림 템플릿 심사 요청`,
          requestReview: true,
        });
        const saved = await admin.from("shop_alimtalk_template_requests").update({ inspection_status: "requested", submitted_at: new Date().toISOString() }).eq("id", templateRowId).eq("shop_id", owner.shopId).select("*").single();
        if (saved.error) throw new Error("status-save");
        row = saved.data;
      } catch {
        await admin.from("shop_alimtalk_template_requests").update({ inspection_status: "unknown" }).eq("id", templateRowId).eq("shop_id", owner.shopId);
        throw new OwnerApiError("검수 요청 결과를 확인하지 못했습니다. 중복 요청을 막기 위해 상태를 확인한 뒤 다시 시도해 주세요.", 502);
      }
    }

    return Response.json({ template: row });
  } catch (error) {
    const status = error instanceof OwnerApiError ? error.status : 400;
    return Response.json({ message: error instanceof OwnerApiError ? error.message : "템플릿 요청 내용을 확인해 주세요." }, { status });
  }
}
