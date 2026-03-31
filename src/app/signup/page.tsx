import { redirect } from "next/navigation";

import SignupForm from "@/components/auth/signup-form";
import { hasSupabaseEnv } from "@/lib/env";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export default async function SignupPage() {
  if (hasSupabaseEnv()) {
    const supabase = await getSupabaseServerClient();
    const { data } = supabase ? await supabase.auth.getUser() : { data: { user: null } };

    if (data.user) {
      redirect("/owner" as never);
    }
  }

  return <SignupForm supabaseReady={hasSupabaseEnv()} />;
}
