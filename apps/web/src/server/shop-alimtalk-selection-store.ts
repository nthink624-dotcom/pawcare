import { getSupabaseAdmin } from "@/lib/supabase/server";
import type { AlimtalkTemplateAlias, NotificationVariableBindings } from "@/lib/notification-registry";

export type ShopAlimtalkSelection = {
  shop_id: string;
  template_alias: AlimtalkTemplateAlias;
  template_code: string;
  template_name: string | null;
  template_content: string;
  template_buttons: unknown;
  variable_bindings: NotificationVariableBindings;
  version: number;
};

export async function readShopAlimtalkSelections(shopId?: string, aliases?: AlimtalkTemplateAlias[]) {
  if (!shopId || aliases?.length === 0) return new Map<AlimtalkTemplateAlias, ShopAlimtalkSelection>();
  const admin = getSupabaseAdmin();
  // The existing no-database demo store has no persistent shop selections.
  // Live Ssodaa delivery still requires its verified DB connection downstream.
  if (!admin) return new Map<AlimtalkTemplateAlias, ShopAlimtalkSelection>();
  let query = admin.from("shop_alimtalk_template_selections").select("*").eq("shop_id", shopId);
  if (aliases) query = query.in("template_alias", aliases);
  const result = await query;
  if (result.error) throw new Error("매장 알림톡 선택을 확인하지 못했습니다.");
  return new Map((result.data ?? []).map((row: ShopAlimtalkSelection) => [row.template_alias, row]));
}
