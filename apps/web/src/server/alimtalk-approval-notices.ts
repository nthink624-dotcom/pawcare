import { createHash } from "node:crypto";
import { ALIMTALK_NOTIFICATION_REGISTRY, type AlimtalkTemplateAlias, type NotificationVariableBindings } from "@/lib/notification-registry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getRelayTemplateCatalog, validateAlimtalkTemplateForAlias } from "@/server/alimtalk-approved-template";
import { matchesShopTemplateSnapshot } from "@/server/shop-alimtalk-template-contract";
import type { AlimtalkApprovalNotice } from "@petmanager/shared/contracts/alimtalk-approval-notice";

type TemplateReference = { shop_id?: string; registeredPlatform?: boolean; template_alias: string | null; template_code: string; template_content: string; template_buttons: unknown; variable_bindings?: NotificationVariableBindings; inspection_status?: string; service_status?: string };

export async function readAlimtalkApprovalNotices(shopId: string, userId: string, retryConcurrentObservation = true): Promise<AlimtalkApprovalNotice[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("알림 저장소를 확인하지 못했습니다.");
  // Read the cursor before the provider call. A late, older response cannot overwrite a newer observation.
  const cursor = await admin.from("shop_alimtalk_approval_sync").select("version").eq("shop_id", shopId).maybeSingle();
  if (cursor.error) throw new Error("승인 알림 상태를 확인하지 못했습니다.");
  const [catalog, requests, platform] = await Promise.all([
    getRelayTemplateCatalog(),
    admin.from("shop_alimtalk_template_requests").select("shop_id,template_alias,template_code,template_content,template_buttons,inspection_status,service_status"),
    admin.from("platform_alimtalk_templates").select("template_alias,provider_template_code,template_content,buttons,variable_bindings,inspection_status,service_status").eq("provider", "ssodaa"),
  ]);
  if (!catalog?.allTemplates || requests.error || platform.error) throw new Error("문구 승인 상태를 확인하지 못했습니다.");
  const privateCodes = new Set((requests.data ?? []).filter(row => row.shop_id !== shopId).map(row => row.template_code));
  const references: TemplateReference[] = [
    ...(platform.data ?? []).map(row => ({ ...row, registeredPlatform: true, template_code: row.provider_template_code, template_buttons: row.buttons })),
    ...(requests.data ?? []).filter(row => row.shop_id === shopId),
  ];
  const snapshot = new Map<string, { alias: AlimtalkTemplateAlias; code: string; fingerprint: string | null }>();
  for (const row of references) {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === row.template_alias);
    if (!spec || !row.template_code || privateCodes.has(row.template_code) || row.inspection_status === "draft" || row.service_status === "deleted") continue;
    const detail = catalog.allTemplates.find(item => item.templateCode === row.template_code);
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
    const key = `${spec.templateAlias}:${row.template_code}`;
    if (!snapshot.get(key)?.fingerprint) snapshot.set(key, { alias: spec.templateAlias, code: row.template_code, fingerprint });
  }
  const saved = await admin.rpc("observe_shop_alimtalk_approvals", { p_shop: shopId, p_expected_version: cursor.data?.version ?? 0, p_snapshot: [...snapshot.values()] });
  // A known rolled-back CAS conflict is safe to retry once, with a fresh cursor
  // and provider snapshot. Never replay a stale snapshot or an uncertain write.
  if (saved.error?.code === "40001" && retryConcurrentObservation) return readAlimtalkApprovalNotices(shopId, userId, false);
  if (saved.error) throw new Error("승인 알림 상태가 변경됐습니다. 다시 확인해 주세요.");
  const rows = await admin.from("shop_alimtalk_approval_notices").select("id,template_alias,template_code,fingerprint,created_at,read_by").eq("shop_id", shopId).order("created_at", { ascending: false });
  if (rows.error) throw new Error("승인 알림을 불러오지 못했습니다.");
  return (rows.data ?? []).filter(row => !row.read_by.includes(userId) && snapshot.get(`${row.template_alias}:${row.template_code}`)?.fingerprint === row.fingerprint).map(row => {
    const spec = ALIMTALK_NOTIFICATION_REGISTRY.find(item => item.templateAlias === row.template_alias)!;
    return { id: row.id, title: `${spec.title} 문구가 승인됐어요`, templateAlias: row.template_alias, templateCode: row.template_code, createdAt: row.created_at } satisfies AlimtalkApprovalNotice;
  });
}
