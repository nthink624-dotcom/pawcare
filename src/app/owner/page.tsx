"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerShell from "@/components/owner/owner-shell";
import { fetchApiJsonWithAuth } from "@/lib/api";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

export default function OwnerPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [message, setMessage] = useState("오너 화면을 불러오는 중입니다.");

  useEffect(() => {
    let active = true;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("Supabase 설정을 확인해 주세요. .env.local 값이 필요합니다.");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.replace("/login" as never);
        router.refresh();
        return;
      }

      setUserEmail(session.user.email ?? null);

      try {
        const bootstrap = await fetchApiJsonWithAuth<BootstrapPayload>("/api/bootstrap");
        if (active) {
          setData(bootstrap);
        }
      } catch (error) {
        if (!active) return;

        const nextMessage = error instanceof Error ? error.message : "오너 화면을 불러오지 못했습니다.";

        if (nextMessage === "로그인이 필요합니다.") {
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (nextMessage.includes("소유한 매장이 없습니다.")) {
          router.replace("/login?error=no-shop" as never);
          router.refresh();
          return;
        }

        setMessage(nextMessage);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [router, supabase]);

  if (!data) {
    return (
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-white px-6 py-10 text-sm text-[#6f6f6f]">
        {message}
      </div>
    );
  }

  return <OwnerShell initialData={data} userEmail={userEmail} />;
}
