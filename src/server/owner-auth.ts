import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

import { env, hasSupabaseEnv } from "@/lib/env";
import { getSupabaseAdmin, getSupabaseServerClient } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import { getBootstrap } from "@/server/repositories/app-repository";

type OwnerAccessContext = {
  userId: string;
  userEmail: string | null;
  shopId: string;
};

type OwnerRouteAccess =
  | { ok: true; context: OwnerAccessContext }
  | { ok: false; response: NextResponse };

async function resolveOwnerShopId(userId: string) {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const existing = await supabase.from("shops").select("id").eq("owner_user_id", userId).maybeSingle();
  if (existing.data?.id) {
    return existing.data.id as string;
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

function buildUnauthorizedResponse(message: string, status = 401) {
  return NextResponse.json({ message }, { status });
}

export async function requireOwnerPageAccess(): Promise<OwnerAccessContext> {
  if (!hasSupabaseEnv()) {
    redirect("/login?error=supabase" as never);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    redirect("/login?error=supabase" as never);
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect("/login" as never);
  }

  const shopId = await resolveOwnerShopId(data.user.id);
  if (!shopId) {
    redirect("/login?error=no-shop" as never);
  }

  return {
    userId: data.user.id,
    userEmail: data.user.email ?? null,
    shopId,
  };
}

export async function getOwnerRouteAccess(): Promise<OwnerRouteAccess> {
  if (!hasSupabaseEnv()) {
    return { ok: false, response: buildUnauthorizedResponse("Supabase 환경 변수가 필요합니다.", 503) };
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return { ok: false, response: buildUnauthorizedResponse("Supabase 연결을 확인해 주세요.", 503) };
  }

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: buildUnauthorizedResponse("로그인이 필요합니다.", 401) };
  }

  const shopId = await resolveOwnerShopId(data.user.id);
  if (!shopId) {
    return { ok: false, response: buildUnauthorizedResponse("연결된 매장 정보를 찾지 못했습니다.", 403) };
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


