"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerShell from "@/components/owner/owner-shell";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
} from "@/lib/auth/social-auth";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
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

export default function OwnerPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [ownedShops, setOwnedShops] = useState<OwnedShopSummary[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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

    async function load() {
      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("Supabase 설정을 확인해 주세요. .env.local 값이 필요합니다.");
        }
        return;
      }

      const session = await getSessionWithRecovery();

      if (!session?.access_token) {
        router.replace("/login" as never);
        router.refresh();
        return;
      }

      setUserEmail(session.user.email ?? null);
      if (session.user.user_metadata?.account_suspended === true) {
        if (active) {
          setMessage("이 계정은 운영자에 의해 일시 정지되었습니다. 운영자에게 문의해 주세요.");
        }
        return;
      }

      const provider =
        pendingProvider === "google" || pendingProvider === "kakao" || pendingProvider === "naver"
          ? pendingProvider
          : resolveSocialProviderFromAuthUser(session.user);

      try {
        const shops = await fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops");
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

        const [bootstrap, subscription] = await Promise.all([
          fetchApiJsonWithAuth<BootstrapPayload>(`/api/bootstrap?shopId=${encodeURIComponent(resolvedShopId)}`),
          fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", { cache: "no-store" }),
        ]);

        if (!active) return;
        setOwnedShops(shops);
        setSelectedShopId(resolvedShopId);
        setData(bootstrap);
        setSubscriptionSummary(subscription);
      } catch (error) {
        if (!active) return;

        const nextMessage = error instanceof Error ? error.message : "오너 화면을 불러오지 못했습니다.";

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
            `/signup/social?next=${encodeURIComponent("/owner")}&provider=${encodeURIComponent(provider)}` as never,
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

  if (!data) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-4 py-6">
        <div className="rounded-[10px] border border-[#e3ddd3] bg-white px-4 py-4 text-[14px] leading-6 text-[#6f665f]">
          {message}
        </div>
      </div>
    );
  }

  return <OwnerShell initialData={data} ownedShops={ownedShops} selectedShopId={selectedShopId} subscriptionSummary={subscriptionSummary} userEmail={userEmail} onSwitchShop={async (shopId) => {
    if (!shopId || shopId === selectedShopId) return;
    setMessage("매장을 바꾸는 중입니다.");
    setData(null);
    const nextBootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(`/api/bootstrap?shopId=${encodeURIComponent(shopId)}`);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, shopId);
    }
    setSelectedShopId(shopId);
    setData(nextBootstrap);
  }} />;
}
