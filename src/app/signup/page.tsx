import SignupForm from "@/components/auth/signup-form";
import { hasPortoneBrowserEnv, hasSupabaseBrowserEnv } from "@/lib/env";

export default function SignupPage() {
  return <SignupForm supabaseReady={hasSupabaseBrowserEnv()} portoneReady={hasPortoneBrowserEnv()} />;
}
