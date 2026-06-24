"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import OwnerShell from "@/components/owner/owner-shell";
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
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";
import { getSupabaseBrowserClient, getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";
import type { BootstrapPayload } from "@/types/domain";
import type { OwnerMobileLaunchPhotoStatusAction } from "@/components/owner/owner-app";
import type { Session } from "@supabase/supabase-js";

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

type OwnerMobileAccessContext = {
  accessToken: string;
  session: Session | null;
};

type MobileAppRole = "owner" | "staff";

type MobileAppRoleContext = {
  appRole: MobileAppRole;
  currentStaffId: string | null;
};

const CURRENT_OWNER_SHOP_STORAGE = "petmanager:owner-current-shop";

function resolveMobileAppRoleContext(session: Session | null): MobileAppRoleContext {
  const params = typeof window === "undefined" ? null : new URLSearchParams(window.location.search);
  const roleParam = params?.get("role")?.trim().toLowerCase() ?? "";
  const staffIdParam = params?.get("staffId")?.trim() || params?.get("staff_id")?.trim() || null;
  const metadata = session?.user.user_metadata ?? {};
  const metadataRole =
    typeof metadata.app_role === "string"
      ? metadata.app_role
      : typeof metadata.role === "string"
        ? metadata.role
        : "";
  const metadataStaffId =
    typeof metadata.staff_id === "string"
      ? metadata.staff_id
      : typeof metadata.staffId === "string"
        ? metadata.staffId
        : null;
  const appRole: MobileAppRole = roleParam === "staff" || metadataRole === "staff" ? "staff" : "owner";

  return {
    appRole,
    currentStaffId: appRole === "staff" ? staffIdParam ?? metadataStaffId : null,
  };
}

function shouldBlockOwnerAccessBySubscription(summary: OwnerSubscriptionSummary) {
  return summary.status === "expired" || summary.status === "past_due";
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

export default function OwnerMobilePage() {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const oauthSupabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);
  const requestedOwnerMobilePath =
    typeof window === "undefined" ? "/owner/mobile" : `${window.location.pathname}${window.location.search}`;
  const launchPhotoStatusAction = useMemo<OwnerMobileLaunchPhotoStatusAction | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const appointmentId = params.get("appointmentId")?.trim() ?? "";
    const rawStatusAction = params.get("statusAction")?.trim() ?? "";
    const statusAction =
      rawStatusAction === "진행 중"
        ? "in_progress"
        : rawStatusAction === "픽업 준비"
          ? "almost_done"
          : rawStatusAction === "완료"
            ? "completed"
          : rawStatusAction;

    if (!appointmentId || (statusAction !== "in_progress" && statusAction !== "completed")) return null;
    return { appointmentId, statusAction, autoOpenCamera: true };
  }, []);
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [ownedShops, setOwnedShops] = useState<OwnedShopSummary[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileRoleContext, setMobileRoleContext] = useState<MobileAppRoleContext>({
    appRole: "owner",
    currentStaffId: null,
  });
  const [message, setMessage] = useState("모바일 오너 화면을 불러오는 중입니다.");

  async function getOwnerAccessContext(): Promise<OwnerMobileAccessContext | null> {
    if (!supabase) return null;

    const handoffSession = consumeOwnerAuthHandoff();
    if (handoffSession) {
      writeOwnerAuthSessionCache(handoffSession);
      setCurrentOwnerAccessToken(handoffSession.accessToken);

      try {
        const sessionResult = (await supabase.auth.setSession({
          access_token: handoffSession.accessToken,
          refresh_token: handoffSession.refreshToken,
        })) as SupabaseSessionResult;
        const nextSession = sessionResult.data.session;
        if (nextSession?.access_token) {
          writeOwnerAuthTokenCache(nextSession.access_token, nextSession.refresh_token);
          setCurrentOwnerAccessToken(nextSession.access_token);
          return {
            accessToken: nextSession.access_token,
            session: nextSession,
          };
        }
      } catch {
        // The handoff token is enough for owner APIs; do not block mobile entry on browser session persistence.
      }

      return {
        accessToken: handoffSession.accessToken,
        session: null,
      };
    }

    const cachedAccessToken = readOwnerAuthTokenCache();
    if (cachedAccessToken) {
      setCurrentOwnerAccessToken(cachedAccessToken);
      return {
        accessToken: cachedAccessToken,
        session: null,
      };
    }

    if (oauthSupabase) {
      const oauthSession = await oauthSupabase.auth.getSession();
      if (oauthSession.data.session?.access_token) {
        writeOwnerAuthTokenCache(oauthSession.data.session.access_token, oauthSession.data.session.refresh_token);
        setCurrentOwnerAccessToken(oauthSession.data.session.access_token);
        return {
          accessToken: oauthSession.data.session.access_token,
          session: oauthSession.data.session,
        };
      }
    }

    const initialSession = await supabase.auth.getSession();
    if (initialSession.data.session?.access_token) {
      writeOwnerAuthTokenCache(initialSession.data.session.access_token, initialSession.data.session.refresh_token);
      setCurrentOwnerAccessToken(initialSession.data.session.access_token);
      return {
        accessToken: initialSession.data.session.access_token,
        session: initialSession.data.session,
      };
    }

    const refreshedSession = await supabase.auth.refreshSession();
    if (refreshedSession.data.session?.access_token) {
      writeOwnerAuthTokenCache(refreshedSession.data.session.access_token, refreshedSession.data.session.refresh_token);
      setCurrentOwnerAccessToken(refreshedSession.data.session.access_token);
      return {
        accessToken: refreshedSession.data.session.access_token,
        session: refreshedSession.data.session,
      };
    }

    const userResult = await supabase.auth.getUser();
    if (userResult.data.user) {
      const recoveredSession = await supabase.auth.getSession();
      if (recoveredSession.data.session?.access_token) {
        writeOwnerAuthTokenCache(recoveredSession.data.session.access_token, recoveredSession.data.session.refresh_token);
        setCurrentOwnerAccessToken(recoveredSession.data.session.access_token);
        return {
          accessToken: recoveredSession.data.session.access_token,
          session: recoveredSession.data.session,
        };
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
          const demoBootstrap = buildOwnerDemoBootstrap();
          setOwnedShops([
            {
              id: demoBootstrap.shop.id,
              name: demoBootstrap.shop.name,
              address: demoBootstrap.shop.address,
              heroImageUrl: demoBootstrap.shop.customer_page_settings.hero_image_url,
            },
          ]);
          setSelectedShopId(demoBootstrap.shop.id);
          setData(demoBootstrap);
          setSubscriptionSummary(null);
          setUserEmail(null);
          setMobileRoleContext({ appRole: "owner", currentStaffId: null });
        }
        return;
      }

      const ownerAccess = await getOwnerAccessContext();

      if (!ownerAccess?.accessToken) {
        router.replace(`/login?next=${encodeURIComponent(requestedOwnerMobilePath)}` as never);
        router.refresh();
        return;
      }

      setUserEmail(ownerAccess.session?.user.email ?? null);
      setMobileRoleContext(resolveMobileAppRoleContext(ownerAccess.session));

      if (ownerAccess.session?.user.user_metadata?.account_suspended === true) {
        if (active) setMessage("이 계정은 운영자에 의해 일시 정지되었습니다. 운영자에게 문의해 주세요.");
        return;
      }

      const provider =
        pendingProvider === "google" || pendingProvider === "kakao" || pendingProvider === "naver"
          ? pendingProvider
          : ownerAccess.session
            ? resolveSocialProviderFromAuthUser(ownerAccess.session.user)
            : "google";

      try {
        const shops = await fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops");
        const storedShopId =
          typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_OWNER_SHOP_STORAGE) : null;
        const resolvedShopId =
          (storedShopId && shops.some((shop) => shop.id === storedShopId) ? storedShopId : shops[0]?.id) ?? null;

        if (!resolvedShopId) throw new Error("소유한 매장이 없습니다.");

        if (typeof window !== "undefined") {
          window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, resolvedShopId);
        }

        const subscription = await fetchApiJsonWithAuth<OwnerSubscriptionSummary>("/api/subscription", { cache: "no-store" });

        if (shouldBlockOwnerAccessBySubscription(subscription)) {
          router.replace(`/owner/billing?compare=1&plan=${encodeURIComponent(subscription.autoRenewPlanCode)}` as never);
          router.refresh();
          return;
        }
        writeOwnerBillingSummaryCache(subscription);

        const bootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(
          `/api/bootstrap?shopId=${encodeURIComponent(resolvedShopId)}`,
          { cache: "no-store" },
        );

        if (!active) return;
        setOwnedShops(shops);
        setSelectedShopId(resolvedShopId);
        setData(bootstrap);
        setSubscriptionSummary(subscription);
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "모바일 오너 화면을 불러오지 못했습니다.";

        if (isOwnerAuthRecoveryError(nextMessage)) {
          clearOwnerAuthTokenCache();
          router.replace(`/login?next=${encodeURIComponent(requestedOwnerMobilePath)}` as never);
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
            `/signup/social?next=${encodeURIComponent(requestedOwnerMobilePath)}&provider=${encodeURIComponent(provider)}` as never,
          );
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

  async function handleSwitchShop(shopId: string) {
    if (!shopId || shopId === selectedShopId) return;
    setMessage("매장을 바꾸는 중입니다.");
    setData(null);
    const nextBootstrap = await fetchApiJsonWithAuth<BootstrapPayload>(
      `/api/bootstrap?shopId=${encodeURIComponent(shopId)}`,
      { cache: "no-store" },
    );
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, shopId);
    }
    setSelectedShopId(shopId);
    setData(nextBootstrap);
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

  return (
    <OwnerShell
      initialData={data}
      ownedShops={ownedShops}
      selectedShopId={selectedShopId}
      subscriptionSummary={subscriptionSummary}
      userEmail={userEmail}
      onSwitchShop={handleSwitchShop}
      appRole={mobileRoleContext.appRole}
      currentStaffId={mobileRoleContext.currentStaffId}
      launchPhotoStatusAction={launchPhotoStatusAction}
    />
  );
}
