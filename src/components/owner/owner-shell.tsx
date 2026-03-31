"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";

import OwnerApp from "@/components/owner/owner-app";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

export default function OwnerShell({ initialData, userEmail }: { initialData: BootstrapPayload; userEmail: string | null }) {
  const router = useRouter();
  const [supabase] = useState<SupabaseClient | null>(() => getSupabaseBrowserClient());
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      if (supabase) {
        await supabase.auth.signOut();
      }
    } finally {
      router.replace("/login" as never);
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <div className="relative">
      <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
        <div className="pointer-events-auto flex w-full max-w-[430px] justify-end">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/95 px-3 py-2 text-xs font-semibold text-[var(--text)] shadow-sm backdrop-blur"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>{loggingOut ? "로그아웃 중" : "로그아웃"}</span>
          </button>
        </div>
      </div>

      <OwnerApp initialData={initialData} />

      {userEmail ? (
        <div className="pointer-events-none fixed inset-x-0 top-14 z-40 flex justify-center px-4">
          <div className="pointer-events-none w-full max-w-[430px] text-right text-[11px] font-medium text-[var(--muted)]">
            {userEmail}
          </div>
        </div>
      ) : null}
    </div>
  );
}


