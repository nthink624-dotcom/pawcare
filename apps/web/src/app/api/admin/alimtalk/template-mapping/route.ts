import { z } from "zod";
import type { NextRequest } from "next/server";

import { serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getRelayTemplateCatalog,
  isApprovedAndUsableTemplate,
  type ConnectedTemplateDetail,
} from "@/server/alimtalk-approved-template";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";

export const dynamic = "force-dynamic";

const alias = "booking_confirmed";
const configKey = "templateBookingConfirmed";
const codeSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);

function templateSummary(template: ConnectedTemplateDetail) {
  return {
    templateCode: template.templateCode,
    templateName: template.templateName ?? "이름 없는 템플릿",
    templateContent: template.templateContent ?? "",
    inspectionStatus: template.inspectionStatus ?? "",
    serviceStatus: template.serviceStatus ?? "",
    buttons: template.buttons.map((button) => ({ name: button.name, type: button.type })),
  };
}

function isReservationConfirmationTemplate(template: ConnectedTemplateDetail) {
  return /예약.*확정|확정.*예약/.test(template.templateName ?? "")
    && template.buttons.length > 0
    && isApprovedAndUsableTemplate(template, alias);
}

async function getAvailableTemplates() {
  const catalog = await getRelayTemplateCatalog();
  if (!catalog) throw new AdminApiError("쏘다 템플릿 목록에 연결하지 못했습니다.", 503);
  return (catalog.allTemplates ?? [])
    .filter(isReservationConfirmationTemplate)
    .map(templateSummary)
    .sort((left, right) => left.templateName.localeCompare(right.templateName, "ko"));
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("알림 설정 저장소를 확인해 주세요.", 503);

    const [templates, mappingResult] = await Promise.all([
      getAvailableTemplates(),
      admin
        .from("platform_alimtalk_templates")
        .select("provider_template_code,template_name,updated_at")
        .eq("provider", "ssodaa")
        .eq("template_alias", alias)
        .eq("inspection_status", "approved")
        .eq("service_status", "active")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    if (mappingResult.error) throw new AdminApiError("현재 알림톡 템플릿을 불러오지 못했습니다.", 503);

    return Response.json({
      templates,
      selectedCode: mappingResult.data?.provider_template_code ?? serverEnv.alimtalkTemplateBookingConfirmed ?? "",
      persistedCode: mappingResult.data?.provider_template_code ?? "",
      selectedName: mappingResult.data?.template_name ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    return Response.json({ message: error instanceof Error ? error.message : "알림톡 템플릿을 불러오지 못했습니다." }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const payload = z.object({ templateCode: codeSchema }).parse(await request.json());
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("알림 설정 저장소를 확인해 주세요.", 503);

    const catalog = await getRelayTemplateCatalog();
    if (!catalog) throw new AdminApiError("쏘다 템플릿 목록에 연결하지 못했습니다.", 503);
    const selected = catalog.allTemplates?.find((item) => item.templateCode === payload.templateCode);
    if (!selected || !isReservationConfirmationTemplate(selected)) {
      throw new AdminApiError("승인되어 발송할 수 있는 예약 확정 템플릿만 선택할 수 있습니다.", 409);
    }

    const conflictingMapping = await admin
      .from("platform_alimtalk_templates")
      .select("template_alias")
      .eq("provider", "ssodaa")
      .eq("provider_template_code", payload.templateCode)
      .eq("service_status", "active")
      .neq("template_alias", alias)
      .maybeSingle();
    if (conflictingMapping.error) throw new AdminApiError("다른 알림 템플릿의 사용 상태를 확인하지 못했습니다.", 503);
    if (conflictingMapping.data) throw new AdminApiError("다른 알림에 이미 연결된 템플릿입니다. 쏘다에서 별도의 예약 확정 템플릿을 선택해 주세요.", 409);

    const now = new Date().toISOString();
    const existingMapping = await admin
      .from("platform_alimtalk_templates")
      .select("id,provider_template_code")
      .eq("provider", "ssodaa")
      .eq("template_alias", alias)
      .eq("service_status", "active")
      .maybeSingle();
    if (existingMapping.error) throw new AdminApiError("현재 알림톡 템플릿 설정을 확인하지 못했습니다.", 503);

    if (existingMapping.data && existingMapping.data.provider_template_code !== payload.templateCode) {
      const disabled = await admin
        .from("platform_alimtalk_templates")
        .update({ service_status: "inactive", updated_at: now })
        .eq("id", existingMapping.data.id)
        .eq("template_alias", alias);
      if (disabled.error) throw new AdminApiError("이전 템플릿 설정을 변경하지 못했습니다.", 503);
    }

    const categoryCode = String((selected as ConnectedTemplateDetail & { categoryCode?: string }).categoryCode ?? "");
    const saved = await admin.from("platform_alimtalk_templates").upsert({
      template_alias: alias,
      notification_type: alias,
      template_config_key: configKey,
      provider: "ssodaa",
      provider_template_code: selected.templateCode,
      template_name: selected.templateName ?? "",
      template_content: selected.templateContent ?? "",
      category_code: categoryCode,
      message_type: "BA",
      emphasize_type: "NONE",
      buttons: selected.buttons,
      inspection_status: "approved",
      service_status: "active",
      rejection_reason: "",
      is_custom: false,
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: "provider,provider_template_code" }).select("provider_template_code,template_name").single();
    if (saved.error || !saved.data) throw new AdminApiError("예약 확정 템플릿을 저장하지 못했습니다.", 503);

    await admin.from("platform_alimtalk_template_events").insert({
      template_alias: alias,
      provider_template_code: payload.templateCode,
      event_type: "mapped",
      previous_status: existingMapping.data ? "active" : null,
      next_status: "active",
      message: "예약 확정 알림 템플릿 적용",
    });

    return Response.json({
      selectedCode: saved.data.provider_template_code,
      selectedName: saved.data.template_name,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 400;
    return Response.json({ message: error instanceof Error ? error.message : "알림톡 템플릿을 적용하지 못했습니다." }, { status });
  }
}
