"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
} from "@/lib/auth/social-auth";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

const CURRENT_OWNER_SHOP_STORAGE = "petmanager:owner-current-shop";
const OWNER_LOAD_TIMEOUT_MS = 12000;

function withOwnerLoadTimeout<T>(promise: Promise<T>, message: string) {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => reject(new Error(message)), OWNER_LOAD_TIMEOUT_MS);
    }),
  ]);
}

function getOwnerLoadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "오너 화면을 불러오지 못했습니다.";
}

export default function OwnerPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [message, setMessage] = useState("오너 화면을 불러오는 중입니다.");

  async function getSessionWithRecovery() {
    if (!supabase) return null;

    const initialSession = await supabase.auth.getSession();
    if (initialSession.data.session?.access_token) {
      return initialSession.data.session;
    }

    const refreshedSession = await supabase.auth.refreshSession();
    if (refreshedSession.data.session?.access_token) {
      return refreshedSession.data.session;
    }

    const userResult = await supabase.auth.getUser();
    if (userResult.data.user) {
      const recoveredSession = await supabase.auth.getSession();
      if (recoveredSession.data.session?.access_token) {
        return recoveredSession.data.session;
      }
    }

    return null;
  }

  useEffect(() => {
    let active = true;
    const pendingProvider =
      typeof window !== "undefined" ? window.localStorage.getItem(PENDING_SOCIAL_PROVIDER_STORAGE) : null;
    let provider: "google" | "kakao" | "naver" | null =
      pendingProvider === "google" || pendingProvider === "kakao" || pendingProvider === "naver"
        ? pendingProvider
        : null;

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("Supabase 설정을 확인해 주세요. .env.local 값이 필요합니다.");
        }
        return;
      }

      try {
        const session = await withOwnerLoadTimeout(
          getSessionWithRecovery(),
          "로그인 상태 확인이 지연되고 있습니다. 다시 로그인해 주세요.",
        );

        if (!session?.access_token) {
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (session.user.user_metadata?.account_suspended === true) {
          if (active) {
            setMessage("이 계정은 운영자에 의해 일시 정지되었습니다. 운영자에게 문의해 주세요.");
          }
          return;
        }

        provider = provider ?? resolveSocialProviderFromAuthUser(session.user);

        const shops = await withOwnerLoadTimeout(
          fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops"),
          "매장 정보를 불러오는 중 지연되고 있습니다. Supabase 또는 Vercel 환경변수를 확인해 주세요.",
        );
        const storedShopId =
          typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_OWNER_SHOP_STORAGE) : null;
        const resolvedShopId =
          (storedShopId && shops.some((shop) => shop.id === storedShopId) ? storedShopId : shops[0]?.id) ?? null;

        if (!resolvedShopId) {
          throw new Error("소유한 매장이 없습니다.");
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, resolvedShopId);
        }

        const bootstrap = await withOwnerLoadTimeout(
          fetchApiJsonWithAuth<BootstrapPayload>(`/api/bootstrap?shopId=${encodeURIComponent(resolvedShopId)}`),
          "오너 초기 데이터를 불러오는 중 지연되고 있습니다. API 또는 Supabase 연결을 확인해 주세요.",
        );

        if (!active) return;
        console.log("[OWNER DEBUG] owner-page-bootstrap", {
          mode: bootstrap.mode,
          shopId: bootstrap.shop.id,
          resolvedShopId,
          appointmentsCount: bootstrap.appointments?.length ?? 0,
          guardiansCount: bootstrap.guardians?.length ?? 0,
          petsCount: bootstrap.pets?.length ?? 0,
          servicesCount: bootstrap.services?.length ?? 0,
          staffMembersCount: 0,
        });
        setSelectedShopId(resolvedShopId);
        setData(bootstrap);
      } catch (error) {
        if (!active) return;

        const nextMessage = getOwnerLoadErrorMessage(error);

        if (nextMessage === "로그인이 필요합니다.") {
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (
          nextMessage.includes("소유한 매장이 없습니다.") ||
          nextMessage.includes("연결된 매장 정보를 찾을 수 없습니다.")
        ) {
          router.replace(
            `/signup/social?next=${encodeURIComponent("/owner")}&provider=${encodeURIComponent(provider ?? "kakao")}` as never,
          );
          router.refresh();
          return;
        }

        if (nextMessage.includes("일시 중지")) {
          setMessage("이 계정은 운영자에 의해 일시 정지되었습니다. 운영자에게 문의해 주세요.");
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

  useEffect(() => {
    if (!selectedShopId || typeof window === "undefined") return;

    let active = true;

    const refreshDesktopData = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const nextBootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(
          `/api/bootstrap?shopId=${encodeURIComponent(selectedShopId)}`,
          { cache: "no-store" },
        );
        if (active) {
          console.log("[OWNER DEBUG] owner-page-refresh", {
            mode: nextBootstrap.mode,
            shopId: nextBootstrap.shop.id,
            selectedShopId,
            appointmentsCount: nextBootstrap.appointments?.length ?? 0,
            staffMembersCount: 0,
          });
          setData(nextBootstrap);
        }
      } catch {
        // Keep the current dashboard stable when a background sync misses.
      }
    };

    const intervalId = window.setInterval(refreshDesktopData, 15000);
    window.addEventListener("focus", refreshDesktopData);
    document.addEventListener("visibilitychange", refreshDesktopData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshDesktopData);
      document.removeEventListener("visibilitychange", refreshDesktopData);
    };
  }, [selectedShopId]);

  if (!data) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-4 py-6">
        <div className="rounded-[10px] border border-[#e3ddd3] bg-white px-4 py-4 text-[14px] leading-6 text-[#6f665f]">
          {message}
        </div>
      </div>
    );
  }

  return <OwnerWebPreview initialData={data} />;
}
