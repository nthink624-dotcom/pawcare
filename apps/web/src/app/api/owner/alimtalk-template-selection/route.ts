import type { NextRequest } from "next/server";
import { z } from "zod";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias, type NotificationVariableBindings } from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { assertOwnerOrManager, OwnerApiError, requireOwnerShop } from "@/server/owner-api-auth";
import { getApprovedSsodaaTemplateDetails, getRelayTemplateCatalog, isCanonicalUnassociatedTemplateForAlias, resolveShopSelectedTemplate, validateAlimtalkTemplateForAlias, type ConnectedTemplateDetail } from "@/server/alimtalk-approved-template";
import { readAlimtalkRows } from "@/server/alimtalk-template-pages";
import { matchesShopTemplateSnapshot } from "@/server/shop-alimtalk-template-contract";
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
  const catalog = await getRelayTemplateCatalog(undefined, true);
  if (!catalog?.allTemplates) throw new OwnerApiError("쏘다 승인 문안 목록을 확인하지 못했습니다. 현재 매장 설정은 유지됩니다.", 503);
  const catalogTemplates = catalog.allTemplates;
  const codes = [...new Set(catalogTemplates.map(detail => detail.templateCode).filter(Boolean))];
  const [requests, platform, selections, ownershipResult] = await Promise.all([
    codes.length ? readAlimtalkRows((from, to) => admin.from("shop_alimtalk_template_requests").select("shop_id,template_alias,template_code,template_name,template_content,template_buttons,is_current").in("template_code", codes).order("id").range(from, to)) : Promise.resolve([]),
    admin.from("platform_alimtalk_templates").select("template_alias,provider_template_code,variable_bindings,inspection_status,service_status").eq("provider", "ssodaa"),
    readShopAlimtalkSelections(shopId),
    codes.length ? admin.from("alimtalk_template_registry").select("template_code,scope,owner_shop_id,retired_at").in("template_code", codes) : Promise.resolve({ data: [], error: null }),
  ]);
  if (platform.error) throw new OwnerApiError("승인된 알림톡 목록을 확인하지 못했습니다. 현재 설정은 유지됩니다.", 503);
  if (ownershipResult.error || !ownershipResult.data) throw new OwnerApiError("승인 문안의 사용 범위를 확인하지 못했습니다. 현재 설정은 유지됩니다.", 503);
  const ownership = new Map(ownershipResult.data.map(row => [row.template_code, row]));
  const shopTemplateCodes = new Set(requests
    .filter(row => row.shop_id === shopId)
    .map(row => `${row.template_alias}:${row.template_code}`));
  const requestedCodes = new Set(requests.map(row => row.template_code));
  const available = catalogTemplates.filter(detail => {
    const code = detail.templateCode;
    const registered = ownership.get(code);
    if (registered?.retired_at) return false;
    if (registered?.scope === "shop") return registered.owner_shop_id === shopId;
    if (registered?.scope === "platform") return !requestedCodes.has(code);
    // Newly approved provider templates are public candidates unless they are
    // in the reserved owner-code namespace or any shop has already claimed them.
    return !/^PM[0-9A-F]{26}$/.test(code) && !requestedCodes.has(code);
  });
  function candidates(alias: AlimtalkTemplateAlias) {
    return available.flatMap(detail => {
      const stored = selections.get(alias);
      const mapped = platform.data?.find(row => row.template_alias === alias && row.provider_template_code === detail.templateCode);
      const own = requests.find(row => row.shop_id === shopId && row.template_alias === alias && row.template_code === detail.templateCode);
      const registered = ownership.get(detail.templateCode);
      if (registered?.scope === "shop" && (!own || registered.owner_shop_id !== shopId || !matchesShopTemplateSnapshot(own, detail))) return [];
      if (!registered && requestedCodes.has(detail.templateCode)) return [];
      // A provider catalog entry without a PetManager alias association must
      // not leak into unrelated notification types merely because its
      // variables happen to be globally valid. Shop requests are already
      // explicitly associated by their saved alias; platform mappings below
      // are explicit alias associations too.
      const aliasMapping = platform.data?.find(row => row.template_alias === alias);
      const aliasReference = aliasMapping
        ? catalogTemplates.find(candidate => candidate.templateCode === aliasMapping.provider_template_code)
        : null;
      if (!own && !mapped && !isCanonicalUnassociatedTemplateForAlias(alias, detail, aliasReference)) return [];
      const bindings: NotificationVariableBindings = mapped?.variable_bindings ?? (stored?.template_code === detail.templateCode ? stored.variable_bindings : {});
      try {
        validateAlimtalkTemplateForAlias(alias, detail, bindings);
        return [{ detail, bindings }];
      } catch { return []; }
    });
  }
  function hasConfiguredTemplate(alias: AlimtalkTemplateAlias) {
    return selections.has(alias)
      || requests.some(row => row.shop_id === shopId && row.template_alias === alias && row.is_current)
      || (platform.data ?? []).some(row => row.template_alias === alias
        && row.inspection_status === "approved" && row.service_status === "active");
  }
  return { admin, catalog, selections, requests, candidates, shopTemplateCodes, hasConfiguredTemplate };
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
    const { catalog, selections, requests, candidates, shopTemplateCodes, hasConfiguredTemplate } = await readCatalog(owner.shopId);
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
      const configured = Boolean(selected) || hasConfiguredTemplate(alias);
      // No mapping is a valid first-use state: owners can choose an approved
      // candidate. Show a blocked state only when an existing connection was
      // expected but could not be verified.
      blocked = blocked || (configured && !current);
      const currentCode = current?.templateCode ?? selected?.template_code;
      const currentSource = currentCode
        ? shopTemplateCodes.has(`${alias}:${currentCode}`) ? "owner" : "petmanager"
        : null;
      const ownerRequest = currentCode
        ? requests.find(row => row.shop_id === owner.shopId && row.template_alias === alias && row.template_code === currentCode)
        : null;
      return {
        alias, title: spec.title, version: selected?.version ?? 0,
        current: current ? { ...publicTemplate(current), ...(currentSource === "owner" ? { name: ownerRequest?.template_name || selected?.template_name || "내 문안" } : { name: "기본 문안" }) } : selected ? { code: selected.template_code, name: selected.template_name || "내 문안", content: selected.template_content, buttons: [] } : null,
        currentSource,
        blocked,
        options: candidates(alias).map(({ detail }) => ({
          ...publicTemplate(detail),
          name: shopTemplateCodes.has(`${alias}:${detail.templateCode}`)
            ? requests.find(row => row.shop_id === owner.shopId && row.template_alias === alias && row.template_code === detail.templateCode)?.template_name || "내 문안"
            : "기본 문안",
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
    if (input.templateAlias === "revisit_notice") {
      throw new OwnerApiError("재방문 일정 안내는 서비스 기본 문안으로 고정되어 오너가 변경할 수 없습니다.", 409);
    }
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
