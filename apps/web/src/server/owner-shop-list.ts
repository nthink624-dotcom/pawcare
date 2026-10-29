import type { OwnerEntryShop } from "@petmanager/shared/contracts/owner-entry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadOwnerShopAccessForUser, OwnerApiError, resolveOwnerShopAccess } from "@/server/owner-api-auth";

type AccessInputs = Parameters<typeof resolveOwnerShopAccess>[0];
type ShopAccessSnapshot = {
  id: string;
  owner_user_id: string | null;
  name: string;
  address: string;
  customer_page_settings: unknown;
  entry_members: AccessInputs["memberships"];
  entry_staff: AccessInputs["staffBindings"];
};

const legacySchemaCodes = new Set(["PGRST200", "PGRST201", "PGRST204", "PGRST205", "42703", "42P01"]);

export async function readOwnerShopSummaries(userId: string): Promise<OwnerEntryShop[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
  const result = await admin.from("shops").select([
    "id,owner_user_id,name,address,customer_page_settings,created_at",
    "entry_members:owner_shop_memberships!owner_shop_memberships_shop_id_fkey(owner_user_id,shop_id,role,is_primary)",
    "entry_staff:staff_members!staff_members_shop_id_fkey(id,shop_id,is_active,auth_user_id)",
  ].join(","))
    .eq("entry_members.owner_user_id", userId)
    .eq("entry_staff.auth_user_id", userId)
    .eq("entry_staff.is_active", true)
    .or(`owner_user_id.eq.${userId},entry_members.not.is.null`)
    .order("created_at");
  if (result.error) {
    if (legacySchemaCodes.has(result.error.code)) return readOwnerShopSummariesLegacy(userId);
    throw new OwnerApiError(result.error.message, 500);
  }
  if (!Array.isArray(result.data)) throw new OwnerApiError("매장 목록을 확인하지 못했습니다.", 503);
  const rows = result.data as unknown as ShopAccessSnapshot[];
  if (rows.some(row => !row || typeof row.id !== "string" || !Array.isArray(row.entry_members) || !Array.isArray(row.entry_staff))) {
    throw new OwnerApiError("매장 접근 정보를 확인하지 못했습니다.", 503);
  }
  // Keep the existing role priority and active staff-binding rules. Related
  // records are also checked here instead of trusting an embedded filter alone.
  const access = resolveOwnerShopAccess({
    userId,
    ownedShops: rows.filter(row => row.owner_user_id === userId).map(row => ({ id: row.id })),
    memberships: rows.flatMap(row => row.entry_members.filter(member => member
      && member.owner_user_id === userId && member.shop_id === row.id
      && ["owner", "manager", "staff"].includes(member.role))),
    staffBindings: rows.flatMap(row => row.entry_staff.filter(staff => staff
      && staff.shop_id === row.id && staff.auth_user_id === userId)),
  });
  const accessible = new Set(access.map(item => item.shopId));
  if (!accessible.size) throw new OwnerApiError("접근할 수 있는 매장이 없습니다.", 403);
  return rows.filter(row => accessible.has(row.id)).map(shop => ({
    id: shop.id, name: shop.name, address: shop.address,
    heroImageUrl: typeof shop.customer_page_settings === "object" && shop.customer_page_settings
      && "hero_image_url" in shop.customer_page_settings && typeof shop.customer_page_settings.hero_image_url === "string"
      ? shop.customer_page_settings.hero_image_url : "",
  }));
}

async function readOwnerShopSummariesLegacy(userId: string): Promise<OwnerEntryShop[]> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new OwnerApiError("인증 설정을 확인해 주세요.", 503);
  const access = await loadOwnerShopAccessForUser(userId);
  if (!access.length) throw new OwnerApiError("접근할 수 있는 매장이 없습니다.", 403);
  const ids = access.map(item => item.shopId);
  const result = await admin.from("shops")
    .select("id,name,address,customer_page_settings,created_at").in("id", ids).order("created_at");
  if (result.error) {
    const missingSettings = /customer_page_settings/i.test(`${result.error.message} ${result.error.details ?? ""} ${result.error.hint ?? ""}`)
      && (/column/i.test(result.error.message) || /schema cache/i.test(result.error.message));
    if (!missingSettings) throw new OwnerApiError(result.error.message, 500);
    const fallback = await admin.from("shops").select("id,name,address,created_at").in("id", ids).order("created_at");
    if (fallback.error) throw new OwnerApiError(fallback.error.message, 500);
    return (fallback.data ?? []).map(shop => ({ id: shop.id, name: shop.name, address: shop.address, heroImageUrl: "" }));
  }
  return (result.data ?? []).map(shop => ({
    id: shop.id,
    name: shop.name,
    address: shop.address,
    heroImageUrl: typeof shop.customer_page_settings === "object" && shop.customer_page_settings
      && "hero_image_url" in shop.customer_page_settings && typeof shop.customer_page_settings.hero_image_url === "string"
      ? shop.customer_page_settings.hero_image_url : "",
  }));
}
