"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";

import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import OwnerServiceExpiredScreen from "@/components/owner/owner-service-expired-screen";
import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  clearOwnerAuthTokenCache,
  consumeOwnerAuthHandoff,
  readOwnerAuthTokenCache,
  setCurrentOwnerAccessToken,
  writeOwnerAuthSessionCache,
  writeOwnerAuthTokenCache,
} from "@/lib/auth/owner-auth-handoff";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import {
  isOwnerSubscriptionBlocked,
  type OwnerSubscriptionSummary,
} from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { readCurrentOwnerShopId, writeCurrentOwnerShopId } from "@/lib/owner-current-shop";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

function isOwnerAuthRecoveryError(message: string) {
  return (
    message === "로그인이 필요합니다." ||
    message.includes("로그인 상태를 확인하지 못했습니다") ||
    message.includes("새로고침 후 다시 시도") ||
    message.toLowerCase().includes("invalid refresh token") ||
    message.toLowerCase().includes("refresh token") ||
    message.toLowerCase().includes("auth session") ||
    message.toLowerCase().includes("jwt")
  );
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
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [message, setMessage] = useState("오너 화면을 불러오는 중입니다.");
  const [loggingOut, setLoggingOut] = useState(false);
  const backgroundRefreshReadyAtRef = useRef(Date.now() + 5000);

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

    async function load() {
      if (shouldOpenMobileOwnerScreen()) {
        router.replace("/owner/mobile" as never);
        return;
      }

      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active) {
          setMessage("서비스 설정을 확인하지 못했습니다. 운영자에게 문의해 주세요.");
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

        setCurrentOwnerAccessToken(ownerAccess.accessToken);
        setAccessToken(ownerAccess.accessToken);

        const storedShopId = readCurrentOwnerShopId();
        const loadSubscription = async () => {
          const subscription = await withOwnerLoadTimeout(
            fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", { cache: "no-store" }),
            "구독 정보를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
          );
          if (active) {
            writeOwnerBillingSummaryCache(subscription);
            setSubscriptionSummary(subscription);
          }
          return subscription;
        };
        const loadOwnedShops = () =>
          withOwnerLoadTimeout(
            fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops"),
            "매장 정보를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
          );
        const loadBootstrap = (shopId: string) =>
          withOwnerLoadTimeout(
            fetchApiJsonWithAuth<BootstrapPayload>(
              `/api/bootstrap?shopId=${encodeURIComponent(shopId)}`,
            ),
            "오너 초기 데이터를 준비하는 중입니다. 첫 실행 또는 새 빌드 직후에는 조금 더 걸릴 수 있습니다.",
          );

        let resolvedShopId = storedShopId;
        let bootstrap: BootstrapPayload;

        try {
          if (resolvedShopId) {
            try {
              bootstrap = await loadBootstrap(resolvedShopId);
            } catch (storedShopError) {
              const shops = await loadOwnedShops();
              if (shops.length === 0) {
                throw new Error("소유한 매장이 없습니다.");
              }
              const fallbackShopId = shops.find((shop) => shop.id !== resolvedShopId)?.id ?? null;
              if (!fallbackShopId) {
                throw storedShopError;
              }
              resolvedShopId = fallbackShopId;
              bootstrap = await loadBootstrap(resolvedShopId);
            }
          } else {
            const shops = await loadOwnedShops();
            resolvedShopId = shops[0]?.id ?? null;
            if (!resolvedShopId) {
              throw new Error("소유한 매장이 없습니다.");
            }
            bootstrap = await loadBootstrap(resolvedShopId);
          }
        } catch (initialLoadError) {
          const subscription = await loadSubscription().catch(() => null);
          if (subscription && isOwnerSubscriptionBlocked(subscription.status)) {
            return;
          }
          throw initialLoadError;
        }

        if (!active) return;
        writeCurrentOwnerShopId(resolvedShopId);
        setSelectedShopId(resolvedShopId);
        setData(bootstrap);
        backgroundRefreshReadyAtRef.current = Date.now() + 5000;
        void loadSubscription().catch(() => {
          // The bootstrap endpoint already validated access. Keep the home visible if this secondary summary misses.
        });
      } catch (error) {
        if (!active) return;

        const nextMessage = getOwnerLoadErrorMessage(error);

        if (isOwnerAuthRecoveryError(nextMessage)) {
          clearOwnerAuthTokenCache();
          router.replace("/login" as never);
          router.refresh();
          return;
        }

        if (
          nextMessage.includes("소유한 매장이 없습니다.") ||
          nextMessage.includes("연결된 매장 정보를 찾을 수 없습니다.")
        ) {
          setMessage("연결된 매장 정보를 찾을 수 없습니다. 고객센터로 문의해 주세요.");
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
      if (Date.now() < backgroundRefreshReadyAtRef.current) return;

      try {
        const nextSubscription = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", {
          cache: "no-store",
        });
        if (!active) return;

        writeOwnerBillingSummaryCache(nextSubscription);
        setSubscriptionSummary(nextSubscription);

        if (isOwnerSubscriptionBlocked(nextSubscription.status)) {
          return;
        }

        const nextBootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(
          `/api/bootstrap?shopId=${encodeURIComponent(selectedShopId)}`,
          { cache: "no-store" },
        );
        if (active) {
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

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);

    try {
      clearOwnerAuthTokenCache();
      await supabase?.auth.signOut();
    } finally {
      router.replace("/login" as never);
      router.refresh();
      setLoggingOut(false);
    }
  };

  if (
    subscriptionSummary &&
    isOwnerSubscriptionBlocked(subscriptionSummary.status)
  ) {
    return (
      <OwnerServiceExpiredScreen
        summary={subscriptionSummary}
        onLogout={handleLogout}
        loggingOut={loggingOut}
      />
    );
  }

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
