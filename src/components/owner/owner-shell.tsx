"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";

import OwnerApp from "@/components/owner/owner-app";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

export default function OwnerShell({
  initialData,
  userEmail,
}: {
  initialData: BootstrapPayload;
  userEmail: string | null;
}) {
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

  return <OwnerApp initialData={initialData} onLogout={handleLogout} loggingOut={loggingOut} userEmail={userEmail} />;
}
