import type { Request } from "express";

import { env, hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseAuthClient } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { getBootstrap } from "@/server/repositories/app-repository";

type OwnerAccessContext = {
  userId: string;
  userEmail: string | null;
  shopId: string;
};

type OwnerRouteAccess =
  | { ok: true; context: OwnerAccessContext }
  | { ok: false; status: number; message: string };

function getBearerToken(request: Request) {
  const authorization = request.header("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice(7).trim() || null;
}

async function resolveOwnerShopId(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const profile = await supabase.from("owner_profiles").select("shop_id").eq("user_id", userId).maybeSingle();
  if (profile.data?.shop_id) {
    const shop = await supabase.from("shops").select("id, owner_user_id").eq("id", profile.data.shop_id).maybeSingle();
    if (shop.data?.id && shop.data.owner_user_id === userId) {
      return shop.data.id as string;
    }

    if (shop.data?.id && !shop.data.owner_user_id) {
      const claimed = await supabase
        .from("shops")
        .update({ owner_user_id: userId, updated_at: nowIso() })
        .eq("id", shop.data.id)
        .is("owner_user_id", null)
        .select("id")
        .maybeSingle();

      if (claimed.data?.id) {
        return claimed.data.id as string;
      }
    }
  }

  const ownedShop = await supabase.from("shops").select("id").eq("owner_user_id", userId).maybeSingle();
  if (ownedShop.data?.id) {
    return ownedShop.data.id as string;
  }

  const demoShop = await supabase.from("shops").select("id, owner_user_id").eq("id", env.demoShopId).maybeSingle();
  if (demoShop.data?.id && !demoShop.data.owner_user_id) {
    const claimed = await supabase
      .from("shops")
      .update({ owner_user_id: userId, updated_at: nowIso() })
      .eq("id", demoShop.data.id)
      .is("owner_user_id", null)
      .select("id")
      .maybeSingle();

    if (claimed.data?.id) {
      return claimed.data.id as string;
    }

    const retried = await supabase.from("shops").select("id").eq("owner_user_id", userId).maybeSingle();
    if (retried.data?.id) {
      return retried.data.id as string;
    }
  }

  return null;
}

export async function getOwnerRouteAccess(request: Request): Promise<OwnerRouteAccess> {
  if (!hasSupabaseEnv()) {
    return { ok: false, status: 503, message: "Supabase 환경 변수가 필요합니다." };
  }

  const token = getBearerToken(request);
  if (!token) {
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  }

  const supabase = getSupabaseAuthClient();
  if (!supabase) {
    return { ok: false, status: 503, message: "Supabase 연결을 확인해 주세요." };
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { ok: false, status: 401, message: "로그인이 필요합니다." };
  }

  const shopId = await resolveOwnerShopId(data.user.id);
  if (!shopId) {
    return { ok: false, status: 403, message: "연결된 매장 정보를 찾지 못했습니다." };
  }

  return {
    ok: true,
    context: {
      userId: data.user.id,
      userEmail: data.user.email ?? null,
      shopId,
    },
  };
}

export async function ensureEntityBelongsToOwnerShop(
  shopId: string,
  kind: "appointment" | "guardian" | "pet" | "record",
  entityId: string,
) {
  const data = await getBootstrap(shopId);

  if (kind === "appointment") {
    return data.appointments.some((item) => item.id === entityId);
  }

  if (kind === "guardian") {
    return data.guardians.some((item) => item.id === entityId);
  }

  if (kind === "pet") {
    return data.pets.some((item) => item.id === entityId);
  }

  return data.groomingRecords.some((item) => item.id === entityId);
}
