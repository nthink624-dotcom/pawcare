import { Suspense } from "react";

import AuthClientCallback from "./client-callback";

export default function AuthClientCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center text-[#111827]">
          <p className="text-[15px]">소셜 로그인 연결을 마무리하고 있습니다.</p>
        </main>
      }
    >
      <AuthClientCallback />
    </Suspense>
  );
}
