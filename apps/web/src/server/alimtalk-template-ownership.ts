import { getSupabaseAdmin } from "@/lib/supabase/server";
import { readAlimtalkRows } from "@/server/alimtalk-template-pages";

type Ownership = { template_code: string; scope: "platform" | "shop"; owner_shop_id: string | null; retired_at: string | null };

export async function readAllowedAlimtalkCodes(codes: readonly string[], shopId?: string, platformOnly = false) {
  const unique = [...new Set(codes)];
  const allowed = new Set<string>();
  if (!unique.length) return allowed;
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("문구 소유권 저장소를 확인하지 못했습니다.");
  for (let index = 0; index < unique.length; index += 200) {
    const result = await admin.from("alimtalk_template_registry").select("template_code,scope,owner_shop_id,retired_at").in("template_code", unique.slice(index, index + 200));
    if (result.error || !result.data) throw new Error("문구 소유권을 확인하지 못했습니다.");
    for (const row of result.data as Ownership[]) {
      if (!row.retired_at && (row.scope === "platform" || (!platformOnly && shopId && row.scope === "shop" && row.owner_shop_id === shopId))) allowed.add(row.template_code);
    }
  }
  return allowed;
}

export async function assertAlimtalkTemplateAccess(code: string, shopId?: string, platformOnly = false) {
  if (!(await readAllowedAlimtalkCodes([code], shopId, platformOnly)).has(code)) throw new Error("이 매장에서 사용할 수 없거나 사용이 중지된 문구입니다.");
}

/** Explicit admin registration may claim a new public code, never a private/retired/reserved owner code. */
export async function assertPlatformAlimtalkCandidate(code: string) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("문구 소유권 저장소를 확인하지 못했습니다.");
  const result = await admin.from("alimtalk_template_registry").select("scope,retired_at").eq("template_code", code).maybeSingle();
  if (result.error) throw new Error("문구 소유권을 확인하지 못했습니다.");
  if (result.data ? result.data.scope !== "platform" || result.data.retired_at : /^PM[0-9A-F]{26}$/.test(code)) {
    throw new Error("매장 전용 또는 사용이 중지된 문구는 공용으로 지정할 수 없습니다.");
  }
}

export async function readActiveAlimtalkCodes(shopIds: readonly string[]) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("문구 소유권 저장소를 확인하지 못했습니다.");
  if (!shopIds.length) return [];
  return readAlimtalkRows((from, to) => admin.from("shop_alimtalk_active_codes").select("shop_id,template_alias,template_code")
    .in("shop_id", [...shopIds]).order("shop_id").order("template_alias").order("template_code").range(from, to));
}

export async function readPlatformAlimtalkCodes(includePending = false) {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("문구 소유권 저장소를 확인하지 못했습니다.");
  let query = admin.from("platform_alimtalk_templates").select("provider_template_code").eq("provider", "ssodaa");
  query = includePending ? query.or("service_status.eq.active,inspection_status.in.(requested,reviewing,unknown,pending)") : query.eq("service_status", "active");
  const result = await query;
  if (result.error) throw new Error("공용 문구를 확인하지 못했습니다.");
  const codes = (result.data ?? []).map(row => row.provider_template_code as string);
  return [...await readAllowedAlimtalkCodes(codes, undefined, true)];
}
