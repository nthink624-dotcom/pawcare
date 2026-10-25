import { z } from "zod";
import type { NextRequest } from "next/server";

import { ALIMTALK_NOTIFICATION_REGISTRY, NOTIFICATION_TEMPLATE_VARIABLE_KEYS, getNotificationTemplateVariables } from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import {
  getRelayTemplateCatalog,
  isApprovedAndUsableTemplate,
  validateAlimtalkTemplateForAlias,
  type ConnectedTemplateDetail,
} from "@/server/alimtalk-approved-template";
import { AdminApiError, requireAdminSession } from "@/server/admin-api-auth";
import { matchesShopTemplateSnapshot } from "@/server/shop-alimtalk-template-contract";

export const dynamic = "force-dynamic";

const alias = "booking_confirmed";
const codeSchema = z.string().trim().min(1).max(100).regex(/^[A-Za-z0-9_-]+$/);

function templateSummary(template: ConnectedTemplateDetail) {
  return {
    templateCode: template.templateCode,
    templateName: template.templateName ?? "이름 없는 템플릿",
    templateContent: template.templateContent ?? "",
    inspectionStatus: template.inspectionStatus ?? "",
    serviceStatus: template.serviceStatus ?? "",
    buttons: template.buttons.map((button) => ({ name: button.name, type: button.type })),
    variables: getNotificationTemplateVariables([template.templateContent ?? "", ...template.buttons.flatMap(button => [button.name,button.linkMobile,button.linkPc ?? ""])]),
  };
}

function getAvailableTemplates(catalog: Awaited<ReturnType<typeof getRelayTemplateCatalog>>) {
  return (catalog?.allTemplates ?? [])
    .filter(template=>isApprovedAndUsableTemplate(template))
    .map(templateSummary)
    .sort((left, right) => left.templateName.localeCompare(right.templateName, "ko"));
}

function buildNotificationMappings(
  catalog: Awaited<ReturnType<typeof getRelayTemplateCatalog>>,
  rows: Array<{
    id: string;
    template_alias: string | null;
    provider_template_code: string | null;
    template_name: string | null;
    inspection_status: string;
    service_status: string;
    updated_at: string;
    variable_bindings?: Record<string,string>;
    template_content: string;
    buttons: unknown;
  }>,
) {
  return ALIMTALK_NOTIFICATION_REGISTRY.map((item) => {
    const platformMapping = rows.find((row) =>
      row.template_alias === item.templateAlias
      && row.service_status === "active"
      && Boolean(row.provider_template_code?.trim()),
    );
    const code = platformMapping?.provider_template_code?.trim();
    const source = code ? "platform" : "none";
    const detail = catalog?.allTemplates?.find(template => template.templateCode === code) ?? null;
    let usable = false;
    if (detail && platformMapping?.inspection_status === "approved") {
      try { validateAlimtalkTemplateForAlias(item.templateAlias,detail,platformMapping.variable_bindings ?? {}); usable=matchesShopTemplateSnapshot({template_code:code,template_content:platformMapping.template_content,template_buttons:platformMapping.buttons},detail); } catch { /* keep the selected mapping visible but blocked */ }
    }

    return {
      type: item.type,
      title: item.title,
      trigger: item.trigger,
      alias: item.templateAlias,
      configKey: item.templateConfigKey,
      notes: item.notes,
      source,
      mappingId: platformMapping?.id ?? null,
      updatedAt: platformMapping?.updated_at ?? null,
      variableBindings: platformMapping?.variable_bindings ?? {},
      templateCode: code || null,
      templateName: detail?.templateName ?? platformMapping?.template_name ?? null,
      templateContent: detail?.templateContent ?? null,
      inspectionStatus: detail?.inspectionStatus ?? null,
      serviceStatus: detail?.serviceStatus ?? null,
      buttons: (detail?.buttons ?? []).map((button) => ({ name: button.name, type: button.type })),
      usable,
    };
  });
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("알림 설정 저장소를 확인해 주세요.", 503);

    const [catalog, mappingsResult] = await Promise.all([
      getRelayTemplateCatalog(),
      admin
        .from("platform_alimtalk_templates")
        .select("id,template_alias,provider_template_code,template_name,template_content,buttons,inspection_status,service_status,variable_bindings,updated_at")
        .eq("provider", "ssodaa")
        .order("updated_at", { ascending: false }),
    ]);
    if (!catalog) throw new AdminApiError("쏘다 릴레이에 연결하지 못했습니다.", 503);
    if (mappingsResult.error) throw new AdminApiError("PetManager 알림 연결 정보를 불러오지 못했습니다.", 503);

    const providerTemplates = (catalog.allTemplates ?? []).map(templateSummary);
    const templates = getAvailableTemplates(catalog);
    const approvedCount = providerTemplates.filter((template) => template.inspectionStatus.toUpperCase() === "APR").length;
    const current = (mappingsResult.data ?? []).find(row=>row.template_alias===alias&&row.service_status==='active');

    return Response.json({
      templates,
      providerTemplates,
      variableKeys: NOTIFICATION_TEMPLATE_VARIABLE_KEYS,
      notificationMappings: buildNotificationMappings(catalog, mappingsResult.data ?? []),
      connection: {
        relayConnected: true,
        ssodaaConnected: catalog.providerStatus?.connected ?? null,
        checkedAt: catalog.providerStatus?.checkedAt ?? null,
        templateCount: catalog.providerStatus?.templateCount ?? providerTemplates.length,
        approvedCount,
        reservationTemplateCount: templates.length,
      },
      selectedCode: current?.provider_template_code ?? "",
      persistedCode: current?.provider_template_code ?? "",
      selectedName: current?.template_name ?? null,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 500;
    return Response.json({ message: error instanceof Error ? error.message : "알림톡 템플릿을 불러오지 못했습니다." }, { status });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminSession(request);
    const payload = z.object({
      templateAlias:z.string().min(1),templateCode:codeSchema,
      variableBindings:z.record(z.string(),z.string()).default({}),
      expectedCurrentId:z.uuid().nullable(),expectedUpdatedAt:z.string().nullable(),
    }).parse(await request.json());
    const spec=ALIMTALK_NOTIFICATION_REGISTRY.find(item=>item.templateAlias===payload.templateAlias);
    if(!spec)throw new AdminApiError("알림 종류를 확인해 주세요.",400);
    const admin = getSupabaseAdmin();
    if (!admin) throw new AdminApiError("알림 설정 저장소를 확인해 주세요.", 503);

    const catalog = await getRelayTemplateCatalog();
    if (!catalog) throw new AdminApiError("쏘다 템플릿 목록에 연결하지 못했습니다.", 503);
    const selected = catalog.allTemplates?.find((item) => item.templateCode === payload.templateCode);
    if (!selected) throw new AdminApiError("선택한 쏘다 템플릿을 확인하지 못했습니다.",409);
    validateAlimtalkTemplateForAlias(spec.templateAlias,selected,payload.variableBindings);

    const conflictingMapping = await admin
      .from("platform_alimtalk_templates")
      .select("template_alias")
      .eq("provider", "ssodaa")
      .eq("provider_template_code", payload.templateCode)
      .eq("service_status", "active")
      .neq("template_alias", spec.templateAlias)
      .maybeSingle();
    if (conflictingMapping.error) throw new AdminApiError("다른 알림 템플릿의 사용 상태를 확인하지 못했습니다.", 503);
    if (conflictingMapping.data) throw new AdminApiError("다른 알림에 이미 연결된 템플릿입니다. 쏘다에서 별도의 예약 확정 템플릿을 선택해 주세요.", 409);

    const saved = await admin.rpc("replace_platform_alimtalk_template", {
      p_alias:spec.templateAlias,p_type:spec.type,p_config_key:spec.templateConfigKey,
      p_template:selected,p_bindings:payload.variableBindings,
      p_expected_current:payload.expectedCurrentId,p_expected_updated_at:payload.expectedUpdatedAt,
    });
    if(saved.error||!saved.data)throw new AdminApiError("연결이 변경되었거나 교체하지 못했습니다. 기존 연결은 유지됩니다. 새로고침 후 다시 확인해 주세요.",409);

    return Response.json({
      selectedCode: selected.templateCode,
      selectedName: selected.templateName,
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminApiError ? error.status : 400;
    return Response.json({ message: error instanceof Error ? error.message : "알림톡 템플릿을 적용하지 못했습니다." }, { status });
  }
}
