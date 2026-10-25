import { createHash } from "node:crypto";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias, type NotificationVariableBindings } from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRelayTemplateCatalog, validateAlimtalkTemplateForAlias, type RelayTemplateCatalogBody } from "@/server/alimtalk-approved-template";
import { readAlimtalkRows } from "@/server/alimtalk-template-pages";
import { readActiveAlimtalkCodes, readPlatformAlimtalkCodes } from "@/server/alimtalk-template-ownership";
import { matchesShopTemplateSnapshot, shopTemplateInspectionState } from "@/server/shop-alimtalk-template-contract";
import type { AlimtalkApprovalNotice } from "@petmanager/shared/contracts/alimtalk-approval-notice";

type TemplateReference = { shop_id?: string; registeredPlatform?: boolean; template_alias: string | null; template_code: string; template_content: string; template_buttons: unknown; variable_bindings?: NotificationVariableBindings; inspection_status?: string; service_status?: string };

export async function syncShopAlimtalkApprovals(shopId: string, suppliedCatalog?: RelayTemplateCatalogBody, retryConcurrentObservation = true) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("알림 저장소를 확인하지 못했습니다.");
  // Read the cursor before the provider call. A late, older response cannot overwrite a newer observation.
  const cursor = await admin.from("shop_alimtalk_approval_sync").select("version").eq("shop_id", shopId).maybeSingle();
  if (cursor.error) throw new Error("승인 알림 상태를 확인하지 못했습니다.");
  const activeCodes = (await readActiveAlimtalkCodes([shopId])).map(row => row.template_code);
  const platformCodes = await readPlatformAlimtalkCodes(true);
  const [catalog, requests, platform] = await Promise.all([
    suppliedCatalog ?? getRelayTemplateCatalog([...platformCodes, ...activeCodes]),
    activeCodes.length ? readAlimtalkRows((from, to) => admin.from("shop_alimtalk_template_requests").select("shop_id,template_alias,template_code,template_content,template_buttons,inspection_status,service_status").eq("shop_id", shopId).in("template_code", activeCodes).order("id").range(from, to)) : [],
    admin.from("platform_alimtalk_templates").select("template_alias,provider_template_code,template_content,buttons,variable_bindings,inspection_status,service_status").eq("provider", "ssodaa"),
  ]);
  if (!catalog?.allTemplates || platform.error) throw new Error("문구 승인 상태를 확인하지 못했습니다.");
  const references: TemplateReference[] = [
    ...(platform.data ?? []).filter(row => platformCodes.includes(row.provider_template_code)).map(row => ({ ...row, registeredPlatform: true, template_code: row.provider_template_code, template_buttons: row.buttons })),
    ...requests,
  ];
  const snapshot = new Map<string, { alias: AlimtalkTemplateAlias; code: string; fingerprint: string | null }>();
  const details = new Map(catalog.allTemplates.map(item => [item.templateCode, item]));
  for (const row of requests) {
    const detail = details.get(row.template_code);
    if (!detail || row.inspection_status === "draft") continue;
    const nextStatus = shopTemplateInspectionState(detail.inspectionStatus);
    const serviceStatus = String(detail.serviceStatus ?? "unknown").toLowerCase();
    if (nextStatus === "approved" && !matchesShopTemplateSnapshot(row, detail)) continue;
    if (nextStatus === row.inspection_status && serviceStatus === row.service_status) continue;
    const updated = await admin.from("shop_alimtalk_template_requests").update({
      inspection_status: nextStatus, service_status: serviceStatus, provider_checked_at: new Date().toISOString(),
    }).eq("shop_id", shopId).eq("template_code", row.template_code).eq("inspection_status", row.inspection_status);
    if (updated.error) throw new Error("문구 심사 결과를 저장하지 못했습니다.");
  }
  const initialPlatformSnapshot: Array<{ alias: AlimtalkTemplateAlias; code: string; fingerprint: string | null }> = [];
  for (const row of references) {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === row.template_alias);
    if (!spec || !row.template_code || row.inspection_status === "draft" || row.service_status === "deleted") continue;
    const detail = details.get(row.template_code);
    let fingerprint: string | null = null;
    try {
      // A registered platform code already has an explicit notification alias.
      // Its newly approved revision may differ from the still-active snapshot:
      // announce that revision without rewriting the mapping or owner selection.
      // Shop submissions still require the exact owner-submitted snapshot.
      if (!detail || (!row.registeredPlatform && !matchesShopTemplateSnapshot(row, detail))) throw new Error("snapshot");
      validateAlimtalkTemplateForAlias(spec.templateAlias, detail, row.variable_bindings ?? {});
      fingerprint = createHash("sha256").update(JSON.stringify([detail.templateCode, detail.templateContent?.replace(/\r\n?/g, "\n").trim(), detail.buttons, row.variable_bindings ?? {}])).digest("hex");
    } catch { /* pending/rejected/stopped/mismatched is not an approval */ }
    if (row.registeredPlatform) initialPlatformSnapshot.push({ alias: spec.templateAlias, code: row.template_code, fingerprint });
    const key = `${spec.templateAlias}:${row.template_code}`;
    if (!snapshot.get(key)?.fingerprint) snapshot.set(key, { alias: spec.templateAlias, code: row.template_code, fingerprint });
  }
  let version = cursor.data?.version ?? 0;
  // Baseline old platform approvals, but announce an owner's already-approved submission even on first sync.
  if (version === 0) {
    const baseline = await admin.rpc("observe_shop_alimtalk_approvals", { p_shop: shopId, p_expected_version: 0, p_snapshot: initialPlatformSnapshot });
    if (baseline.error?.code === "40001" && retryConcurrentObservation) return syncShopAlimtalkApprovals(shopId, undefined, false);
    if (baseline.error) throw new Error("승인 알림 기준 상태를 저장하지 못했습니다.");
    version = 1;
  }
  const saved = await admin.rpc("observe_shop_alimtalk_approvals", { p_shop: shopId, p_expected_version: version, p_snapshot: [...snapshot.values()] });
  if (saved.error?.code === "40001" && retryConcurrentObservation) return syncShopAlimtalkApprovals(shopId, undefined, false);
  if (saved.error) throw new Error("승인 알림 상태가 변경됐습니다. 다시 확인해 주세요.");
}

/** Owner polling reads durable state only. It never fans out into provider API calls. */
export async function readAlimtalkApprovalNotices(shopId: string, userId: string): Promise<AlimtalkApprovalNotice[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("알림 저장소를 확인하지 못했습니다.");
  const cursor = await admin.from("shop_alimtalk_approval_sync").select("observed").eq("shop_id", shopId).maybeSingle();
  if (cursor.error) throw new Error("승인 알림 상태를 확인하지 못했습니다.");
  const observed = (cursor.data?.observed ?? {}) as Record<string, string | null>;
  const rows = await readAlimtalkRows((from, to) => admin.from("shop_alimtalk_approval_notices").select("id,template_alias,template_code,fingerprint,created_at,read_by").eq("shop_id", shopId).order("created_at", { ascending: false }).order("id").range(from, to));
  return rows.filter(row => !row.read_by.includes(userId) && observed[`${row.template_alias}:${row.template_code}`] === row.fingerprint && ALIMTALK_NOTIFICATION_REGISTRY.some(item => item.templateAlias === row.template_alias)).map(row => {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === row.template_alias)!;
    return { id: row.id, title: `${spec.title} 문구가 승인됐어요`, templateAlias: row.template_alias, templateCode: row.template_code, createdAt: row.created_at } satisfies AlimtalkApprovalNotice;
  });
}
