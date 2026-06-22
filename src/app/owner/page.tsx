"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  clearOwnerAuthTokenCache,
  consumeOwnerAuthHandoff,
  readOwnerAuthTokenCache,
  setCurrentOwnerAccessToken,
  writeOwnerAuthSessionCache,
  writeOwnerAuthTokenCache,
} from "@/lib/auth/owner-auth-handoff";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
} from "@/lib/auth/social-auth";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { getSupabaseBrowserClient, getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";

type OwnedShopSummary = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

type SupabaseSessionResult = {
  data: {
    session: Session | null;
  };
};

type OwnerAccessContext = {
  accessToken: string;
  session: Session | null;
};

const CURRENT_OWNER_SHOP_STORAGE = "petmanager:owner-current-shop";
const OWNER_LOAD_TIMEOUT_MS = 30000;
const OWNER_SESSION_SLOW_NOTICE_MS = 8000;
const OWNER_SESSION_TIMEOUT_MS = 10000;
const OWNER_BACKGROUND_REFRESH_MS = 60_000;

function shouldOpenMobileOwnerScreen() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isMobileUserAgent = /android|iphone|ipod|mobile/.test(userAgent);
  const isCompactTouchViewport =
    window.matchMedia("(max-width: 767px)").matches && window.matchMedia("(pointer: coarse)").matches;

  return isMobileUserAgent || isCompactTouchViewport;
}

function withOwnerLoadTimeout<T>(promise: Promise<T>, message: string) {
  let timeoutId: number | null = null;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }),
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(() => reject(new Error(message)), OWNER_LOAD_TIMEOUT_MS);
    }),
  ]);
}

function getOwnerLoadErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return "오너 화면을 불러오지 못했습니다.";
}

function shouldBlockOwnerAccessBySubscription(summary: OwnerSubscriptionSummary) {
  return summary.status === "expired" || summary.status === "past_due";
}

function withOwnerSessionTimeout<T>(promise: Promise<T>): Promise<T> {
  let timeoutId: number | null = null;

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    }),
    new Promise<T>((_, reject) => {
      timeoutId = window.setTimeout(
        () => reject(new Error("로그인 상태를 확인하지 못했습니다. 다시 로그인해 주세요.")),
        OWNER_SESSION_TIMEOUT_MS,
      );
    }),
  ]);
}

export default function OwnerPage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const oauthSupabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [message, setMessage] = useState("오너 화면을 불러오는 중입니다.");

  async function getOwnerAccessContext(): Promise<OwnerAccessContext | null> {
    if (!supabase) return null;

    const handoffSession = consumeOwnerAuthHandoff();
    if (handoffSession) {
      writeOwnerAuthSessionCache(handoffSession);
      void supabase.auth
        .setSession({
          access_token: handoffSession.accessToken,
          refresh_token: handoffSession.refreshToken,
        })
        .then((sessionResult: SupabaseSessionResult) => {
          const nextSession = sessionResult.data.session;
          if (nextSession?.access_token) {
            writeOwnerAuthTokenCache(nextSession.access_token, nextSession.refresh_token);
            setCurrentOwnerAccessToken(nextSession.access_token);
          }
        })
        .catch(() => {
          // The freshly issued API token is enough for owner endpoints; do not block entry on browser session persistence.
        });

      return {
        accessToken: handoffSession.accessToken,
        session: null,
      };
    }

    const cachedAccessToken = readOwnerAuthTokenCache();
    if (cachedAccessToken) {
      return {
        accessToken: cachedAccessToken,
        session: null,
      };
    }

    if (oauthSupabase) {
      const oauthSession = await withOwnerSessionTimeout(
        oauthSupabase.auth.getSession() as Promise<SupabaseSessionResult>,
      );
      if (oauthSession.data.session?.access_token) {
        writeOwnerAuthTokenCache(oauthSession.data.session.access_token, oauthSession.data.session.refresh_token);
        setCurrentOwnerAccessToken(oauthSession.data.session.access_token);
        return {
          accessToken: oauthSession.data.session.access_token,
          session: oauthSession.data.session,
        };
      }
    }

    const initialSession = await withOwnerSessionTimeout(
      supabase.auth.getSession() as Promise<SupabaseSessionResult>,
    );
    if (initialSession.data.session?.access_token) {
      writeOwnerAuthTokenCache(initialSession.data.session.access_token);
      return {
        accessToken: initialSession.data.session.access_token,
        session: initialSession.data.session,
      };
    }

    const refreshedSession = await withOwnerSessionTimeout(
      supabase.auth.refreshSession() as Promise<SupabaseSessionResult>,
    );
    if (refreshedSession.data.session?.access_token) {
      writeOwnerAuthTokenCache(refreshedSession.data.session.access_token);
      return {
        accessToken: refreshedSession.data.session.access_token,
        session: refreshedSession.data.session,
      };
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
      if (shouldOpenMobileOwnerScreen()) {
        router.replace("/owner/mobile" as never);
        return;
      }

      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("Supabase 설정을 확인해 주세요. .env.local 값이 필요합니다.");
        }
        return;
      }

      try {
        const slowSessionNotice = window.setTimeout(() => {
          if (active) {
            setMessage("로그인 상태를 확인하는 중입니다. 잠시만 기다려 주세요.");
          }
        }, OWNER_SESSION_SLOW_NOTICE_MS);
        const ownerAccess = await getOwnerAccessContext().finally(() => {
          window.clearTimeout(slowSessionNotice);
        });

        if (!ownerAccess?.accessToken) {
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (ownerAccess.session?.user.user_metadata?.account_suspended === true) {
          if (active) {
            setMessage("이 계정은 운영자에 의해 일시 정지되었습니다. 운영자에게 문의해 주세요.");
          }
          return;
        }

        provider = ownerAccess.session ? provider ?? resolveSocialProviderFromAuthUser(ownerAccess.session.user) : provider;
        setCurrentOwnerAccessToken(ownerAccess.accessToken);
        setAccessToken(ownerAccess.accessToken);

        const shops = await withOwnerLoadTimeout(
          fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops"),
          "매장 정보를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
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

        const subscription = await withOwnerLoadTimeout(
          fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", { cache: "no-store" }),
          "구독 정보를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
        );

        if (shouldBlockOwnerAccessBySubscription(subscription)) {
          router.replace(`/owner/billing?compare=1&plan=${encodeURIComponent(subscription.autoRenewPlanCode)}` as never);
          router.refresh();
          return;
        }
        writeOwnerBillingSummaryCache(subscription);
        setSubscriptionSummary(subscription);

        const bootstrap = await withOwnerLoadTimeout(
          fetchApiJsonWithAuth<BootstrapPayload>(`/api/bootstrap?shopId=${encodeURIComponent(resolvedShopId)}`),
          "오너 초기 데이터를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
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
          clearOwnerAuthTokenCache();
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (nextMessage.includes("서비스 이용 기간이 만료") || nextMessage.includes("결제 정보를 확인")) {
          router.replace("/owner/billing?compare=1" as never);
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
    if (!selectedShopId || !accessToken || typeof window === "undefined") return;

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
            staffMembersCount: nextBootstrap.staffMembers?.length ?? 0,
          });
          setData(nextBootstrap);
        }
      } catch {
        // Keep the current dashboard stable when a background sync misses.
      }
    };

    const intervalId = window.setInterval(refreshDesktopData, OWNER_BACKGROUND_REFRESH_MS);
    window.addEventListener("focus", refreshDesktopData);
    document.addEventListener("visibilitychange", refreshDesktopData);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshDesktopData);
      document.removeEventListener("visibilitychange", refreshDesktopData);
    };
  }, [accessToken, selectedShopId]);

  if (!data) {
    return (
      <div className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#faf7f2] px-4 py-6">
        <div className="rounded-[10px] border border-[#e3ddd3] bg-white px-4 py-4 text-[14px] leading-6 text-[#6f665f]">
          {message}
        </div>
      </div>
    );
  }

  return <OwnerWebPreview initialData={data} onDataChange={setData} currentPlanCode={subscriptionSummary?.currentPlanCode ?? null} />;
}
