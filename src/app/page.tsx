import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import LandingPage from "@/components/landing/landing-page";
import { env } from "@/lib/env";
import { getSupabaseCookieOptions } from "@/lib/supabase/cookie-options";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function Home() {
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

  const data = await getBootstrap("demo-shop");

  return <LandingPage shop={data.shop} services={data.services.filter((item) => item.is_active)} />;
}
