import type { NextRequest } from "next/server";
import { z } from "zod";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias, type NotificationVariableBindings } from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { getApprovedSsodaaTemplateDetails, getRelayTemplateCatalog, resolveShopSelectedTemplate, validateAlimtalkTemplateForAlias, type ConnectedTemplateDetail } from "@/server/alimtalk-approved-template";
import { readShopAlimtalkSelections } from "@/server/shop-alimtalk-selection-store";

export const dynamic = "force-dynamic";
const inputSchema = z.object({
  shopId: z.string().trim().min(1).max(100),
  templateAlias: z.string().min(1).max(100),
  templateCode: z.string().trim().min(1).max(100),
  expectedVersion: z.number().int().min(0),
});

async function readCatalog(shopId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("알림톡 설정을 불러오지 못했습니다.", 503);
  const [catalog, requests, platform, selections] = await Promise.all([
    getRelayTemplateCatalog(),
    admin.from("shop_alimtalk_template_requests").select("shop_id,template_alias,template_code"),
    admin.from("platform_alimtalk_templates").select("template_alias,provider_template_code,variable_bindings").eq("provider", "ssodaa"),
    readShopAlimtalkSelections(shopId),
  ]);
  if (!catalog?.allTemplates || requests.error || platform.error) throw new OwnerApiError("승인된 알림톡 목록을 확인하지 못했습니다. 현재 설정은 유지됩니다.", 503);
  const shopTemplateCodes = new Set((requests.data ?? [])
    .filter(row => row.shop_id === shopId)
    .map(row => `${row.template_alias}:${row.template_code}`));
  const available = catalog.allTemplates.filter(detail => !(requests.data ?? []).some(row => row.template_code === detail.templateCode && row.shop_id !== shopId));
  function candidates(alias: AlimtalkTemplateAlias) {
    return available.flatMap(detail => {
      const stored = selections.get(alias);
      const mapped = platform.data?.find(row => row.template_alias === alias && row.provider_template_code === detail.templateCode);
      const bindings: NotificationVariableBindings = mapped?.variable_bindings ?? (stored?.template_code === detail.templateCode ? stored.variable_bindings : {});
      try {
        validateAlimtalkTemplateForAlias(alias, detail, bindings);
        return [{ detail, bindings }];
      } catch { return []; }
    });
  }
  return { admin, catalog, selections, candidates, shopTemplateCodes };
}

function publicTemplate(detail: ConnectedTemplateDetail) {
  return {
    code: detail.templateCode, name: detail.templateName || "승인된 문구",
    content: detail.templateContent || "", buttons: detail.buttons.map(button => button.name),
  };
}

export async function GET(request: NextRequest) {
  try {
    const owner = await requireOwnerShop(request, new URL(request.url).searchParams.get("shopId") || undefined);
    assertOwnerOrManager(owner);
    const { catalog, selections, candidates, shopTemplateCodes } = await readCatalog(owner.shopId);
    const aliases = Array.from(new Set(ALIMTALK_NOTIFICATION_REGISTRY.map(item => item.templateAlias)));
    const defaults = await getApprovedSsodaaTemplateDetails(aliases.filter(alias => !selections.has(alias)), owner.shopId, catalog).catch(() => ({} as Partial<Record<AlimtalkTemplateAlias, ConnectedTemplateDetail>>));
    const items = await Promise.all(aliases.map(async alias => {
      const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === alias)!;
      const selected = selections.get(alias);
      let current: ConnectedTemplateDetail | null = null, blocked = false;
      try {
        current = selected ? resolveShopSelectedTemplate(alias, selected, catalog)
          : defaults[alias] ?? null;
      } catch { blocked = true; }
      const currentCode = current?.templateCode ?? selected?.template_code;
      const currentSource = currentCode
        ? shopTemplateCodes.has(`${alias}:${currentCode}`) ? "owner" : "petmanager"
        : null;
      return {
        alias, title: spec.title, version: selected?.version ?? 0,
        current: current ? publicTemplate(current) : selected ? { code: selected.template_code, name: selected.template_name || "선택한 문구", content: selected.template_content, buttons: [] } : null,
        currentSource,
        blocked: blocked || !current,
        options: candidates(alias).map(({ detail }) => ({
          ...publicTemplate(detail),
          source: shopTemplateCodes.has(`${alias}:${detail.templateCode}`) ? "owner" as const : "petmanager" as const,
        })),
      };
    }));
    return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function PUT(request: NextRequest) {
  try {
    const input = inputSchema.parse(await request.json());
    const owner = await requireOwnerShop(request, input.shopId);
    assertOwnerOrManager(owner);
    if (!owner.userId) throw new OwnerApiError("다시 로그인해 주세요.", 401);
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === input.templateAlias);
    if (!spec) throw new OwnerApiError("알림 종류를 확인해 주세요.", 400);
    const { admin, candidates } = await readCatalog(owner.shopId);
    const chosen = candidates(spec.templateAlias).find(({ detail }) => detail.templateCode === input.templateCode);
    if (!chosen) throw new OwnerApiError("현재 승인되어 사용할 수 있는 문구를 다시 선택해 주세요. 기존 설정은 유지됩니다.", 409);
    const result = await admin.rpc("set_shop_alimtalk_template_selection", {
      p_shop: owner.shopId, p_alias: spec.templateAlias, p_template: chosen.detail,
      p_bindings: chosen.bindings, p_expected_version: input.expectedVersion, p_actor: owner.userId,
    });
    if (result.error || !result.data) throw new OwnerApiError("설정이 변경되었거나 저장하지 못했습니다. 새로고침 후 다시 선택해 주세요.", 409);
    return Response.json({ saved: true, version: result.data.version });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  return Response.json({ message: error instanceof OwnerApiError ? error.message : "알림톡 설정을 처리하지 못했습니다." }, { status: error instanceof OwnerApiError ? error.status : error instanceof z.ZodError ? 400 : 503 });
}
