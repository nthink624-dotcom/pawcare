import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { env } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const hasOAuthCallbackParams =
    typeof params.code === "string" ||
    typeof params.error === "string" ||
    typeof params.error_code === "string" ||
    typeof params.error_description === "string";

  if (hasOAuthCallbackParams) {
    const callbackParams = new URLSearchParams();

    for (const [key, value] of Object.entries(params)) {
      if (Array.isArray(value)) {
        value.forEach((item) => callbackParams.append(key, item));
      } else if (typeof value === "string") {
        callbackParams.set(key, value);
      }
    }

    if (!callbackParams.has("next")) {
      callbackParams.set("next", "/owner");
    }

    redirect(`/auth/callback?${callbackParams.toString()}` as never);
  }

  if (env.supabaseUrl && env.supabasePublishableKey) {
    const cookieStore = await cookies();
    const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
      cookieOptions: getSupabaseCookieOptions(),
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

    if (session?.user) {
      redirect("/owner");
    }
  }

  redirect("/login?next=%2Fowner" as never);
}
