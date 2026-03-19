"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

import type { BootstrapPayload } from "@/types/domain";

const OwnerShell = dynamic(() => import("@/components/owner/owner-shell"), {
  ssr: false,
  loading: () => <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center text-sm text-[var(--muted)]">오너 앱을 준비하고 있어요.</div>,
});

export default function OwnerPage() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/bootstrap?shopId=demo-shop")
      .then(async (response) => {
        const raw = await response.text();
        if (!raw.trim()) {
          throw new Error("오너 앱 응답이 비어 있어요. 서버를 다시 확인해 주세요.");
        }

        let json: BootstrapPayload | { message?: string };
        try {
          json = JSON.parse(raw) as BootstrapPayload | { message?: string };
        } catch {
          throw new Error("오너 앱 응답이 비어 있어요. 서버를 다시 확인해 주세요.");
        }

        if (!response.ok) throw new Error(("message" in json && json.message) || "오너 앱을 불러오지 못했습니다.");
        if (active) setData(json as BootstrapPayload);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError instanceof Error ? fetchError.message : "오너 앱을 불러오지 못했습니다.");
      });

    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center px-5 text-sm text-red-600">{error}</div>;
  }

  if (!data) {
    return <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-center justify-center text-sm text-[var(--muted)]">오너 앱을 불러오고 있어요.</div>;
  }

  return <OwnerShell initialData={data} />;
}


