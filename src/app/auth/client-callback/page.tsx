import { Suspense } from "react";

import AuthClientCallback from "./client-callback";
import SocialAuthProgress from "@/components/auth/social-auth-progress";

export default function AuthClientCallbackPage() {
  return (
    <Suspense
      fallback={<SocialAuthProgress />}
    >
      <AuthClientCallback />
    </Suspense>
  );
}
