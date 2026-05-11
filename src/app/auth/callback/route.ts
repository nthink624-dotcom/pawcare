import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env } from "@/lib/env";
import { PENDING_SOCIAL_PROVIDER_COOKIE, resolveSocialProviderFromAuthUser } from "@/lib/auth/social-auth";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const callbackError = requestUrl.searchParams.get("error");
  const callbackErrorDescription = requestUrl.searchParams.get("error_description");
  const rawNext = requestUrl.searchParams.get("next") || "/owner";
  const next = rawNext.startsWith("/") ? rawNext : "/owner";
  const requestedProvider = requestUrl.searchParams.get("provider");
  const authCookies: Array<{
    name: string;
    value: string;
    options?: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  function redirectWithAuthCookies(path: string, clearPendingProvider = false) {
    const response = NextResponse.redirect(new URL(path, requestUrl.origin));
    authCookies.forEach(({ name, value, options }) => {
      response.cookies.set(name, value, options);
    });

    if (clearPendingProvider) {
      response.cookies.set(PENDING_SOCIAL_PROVIDER_COOKIE, "", { path: "/", maxAge: 0 });
    }

    return response;
  }

  function redirectToLogin(error: string, detail?: string | null) {
    const params = new URLSearchParams({
      error,
      next,
    });
    if (detail) {
      params.set("detail", detail.slice(0, 180));
    }

    return redirectWithAuthCookies(
      `/login?${params.toString()}`,
      true,
    );
  }

  if (callbackError) {
    return redirectToLogin(
      callbackError === "access_denied" ? "social-access-denied" : "social-oauth",
      callbackErrorDescription || callbackError,
    );
  }

  if (!code) {
    return redirectToLogin("social-callback");
  }

  if (!env.supabaseUrl || !env.supabasePublishableKey) {
    return redirectToLogin("supabase");
  }

  const cookieStore = await cookies();
  const cookieProvider = cookieStore.get(PENDING_SOCIAL_PROVIDER_COOKIE)?.value;
  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookieOptions: getSupabaseCookieOptions({ secure: requestUrl.protocol === "https:" }),
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set({ name, value, ...options });
          authCookies.push({ name, value, options });
        });
      },
    },
  });

  const exchanged = await supabase.auth.exchangeCodeForSession(code);
  if (exchanged.error) {
    return redirectToLogin("social-callback", exchanged.error.message);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirectToLogin("social-session");
  }

  const admin = getSupabaseAdmin();
  if (admin) {
    const shopResult = await admin.from("shops").select("id").eq("owner_user_id", user.id).maybeSingle();

    if (!shopResult.error && !shopResult.data?.id) {
      const provider =
        requestedProvider === "google" || requestedProvider === "kakao" || requestedProvider === "naver"
          ? requestedProvider
          : cookieProvider === "google" || cookieProvider === "kakao" || cookieProvider === "naver"
            ? cookieProvider
            : resolveSocialProviderFromAuthUser(user);

      return redirectWithAuthCookies(
        `/signup/social?next=${encodeURIComponent(next)}&provider=${encodeURIComponent(provider)}`,
        true,
      );
    }
  }

  return redirectWithAuthCookies(next, true);
}
