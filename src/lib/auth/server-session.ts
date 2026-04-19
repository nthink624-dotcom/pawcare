import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function getServerSessionUser() {
  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user ?? null;
}

export async function getServerUserShopId(userId: string) {
  const admin = getSupabaseAdmin();

  if (!admin) {
    return null;
  }

  const shopResult = await admin.from("shops").select("id").eq("owner_user_id", userId).maybeSingle();

  if (shopResult.error) {
    return null;
  }

  return shopResult.data?.id ?? null;
}
