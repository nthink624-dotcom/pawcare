import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { ConnectedTemplateDetail } from "@/server/alimtalk-approved-template";

export async function readPersistedAlimtalkDetails(codes: readonly string[]) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Template cache unavailable");
  const result = await admin.from("alimtalk_template_provider_cache").select("template_code,detail,valid_until").in("template_code", [...codes]);
  if (result.error) throw new Error("Template cache read failed");
  const details = new Map<string, ConnectedTemplateDetail>();
  for (const row of result.data ?? []) if (Date.parse(row.valid_until) > Date.now() && row.detail?.templateCode === row.template_code) details.set(row.template_code, row.detail as ConnectedTemplateDetail);
  return details;
}

export async function persistAlimtalkDetails(details: ConnectedTemplateDetail[], checkedAt: number) {
  if (!details.length) return;
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Template cache unavailable");
  const ownership = await admin.from("alimtalk_template_registry").select("template_code,retired_at").in("template_code", details.map(row => row.templateCode));
  if (ownership.error) throw new Error("Template cache ownership unavailable");
  const known = new Set((ownership.data ?? []).filter(row => !row.retired_at).map(row => row.template_code));
  const rows = details.filter(row => known.has(row.templateCode)).map(detail => ({
    template_code: detail.templateCode, detail, checked_at: new Date(checkedAt).toISOString(),
    valid_until: new Date(checkedAt + (detail.inspectionStatus === "APR" ? 300_000 : 60_000)).toISOString(),
  }));
  if (!rows.length) return;
  const result = await admin.from("alimtalk_template_provider_cache").upsert(rows, { onConflict: "template_code" });
  if (result.error) throw new Error("Template cache persistence failed");
}
