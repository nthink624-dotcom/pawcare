import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/owner";

  if (code && env.supabaseUrl && env.supabasePublishableKey) {
    const cookieStore = await cookies();
    const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    });

    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    if (!exchanged.error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const admin = getSupabaseAdmin();
        if (admin) {
          const shopResult = await admin.from("shops").select("id").eq("owner_user_id", user.id).maybeSingle();

          if (!shopResult.error && !shopResult.data?.id) {
            const provider = typeof user.app_metadata?.provider === "string" ? user.app_metadata.provider : "google";
            return NextResponse.redirect(
              new URL(
                `/signup/social?next=${encodeURIComponent(next)}&provider=${encodeURIComponent(provider)}`,
                requestUrl.origin,
              ),
            );
          }
        }
      }
    }
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
