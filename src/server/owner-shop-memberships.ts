import type { SupabaseClient } from "@supabase/supabase-js";

type OwnerShopMembershipInput = {
  ownerUserId: string;
  shopId: string;
  isPrimary?: boolean;
  now?: string;
};

function isMissingMembershipTableError(error: { message?: string; code?: string } | null) {
  const message = error?.message ?? "";
  return error?.code === "42P01" || /owner_shop_memberships|schema cache|does not exist/i.test(message);
}

export async function upsertOwnerShopMembership(
  supabase: SupabaseClient,
  input: OwnerShopMembershipInput,
) {
  const timestamp = input.now ?? new Date().toISOString();

  const result = await supabase.from("owner_shop_memberships").upsert(
    {
      owner_user_id: input.ownerUserId,
      shop_id: input.shopId,
      role: "owner",
      is_primary: input.isPrimary ?? false,
      created_at: timestamp,
      updated_at: timestamp,
    },
    { onConflict: "owner_user_id,shop_id" },
  );

  if (result.error && !isMissingMembershipTableError(result.error)) {
    throw new Error(result.error.message || "매장 소유권 정보를 저장하지 못했습니다.");
  }
}
