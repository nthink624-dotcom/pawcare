import type { OwnerEntryShop } from "@petmanager/shared/contracts/owner-entry";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { loadOwnerShopAccessForUser, OwnerApiError } from "@/server/owner-api-auth";

export async function readOwnerShopSummaries(userId: string): Promise<OwnerEntryShop[]> {
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
