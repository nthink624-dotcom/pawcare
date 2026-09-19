"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";

import OwnerInitialSetupFlow from "@/components/owner/owner-initial-setup-flow";
import OwnerShell from "@/components/owner/owner-shell";
import { ApiRequestError, fetchApiJsonWithAuth } from "@/lib/api";
import {
  assertOwnerBootstrapPayload,
  OWNER_MOBILE_AUTHORITY_ERROR_MESSAGE,
  resolveOwnerMobileRoleContext,
  type OwnerMobileRoleContext,
} from "@/lib/owner-customer-pet-integrity";
import {
  clearOwnerAuthTokenCache,
  clearOwnerAuthHandoff,
  createLatestOwnerAccessGate,
  peekOwnerAuthHandoff,
  readOwnerAuthTokenCache,
  setCurrentOwnerAccessToken,
  writeOwnerAuthSessionCache,
  writeOwnerAuthTokenCache,
} from "@/lib/auth/owner-auth-handoff";
import { writeOwnerBillingSummaryCache } from "@/lib/billing/owner-billing-navigation";
import type { OwnerSubscriptionSummary } from "@/lib/billing/owner-subscription";
import { hasSupabaseBrowserEnv } from "@/lib/env";
import { pruneExpiredPendingOwnerStatusPhotos } from "@/lib/media/owner-pending-status-photo";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
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

type OwnerInitialSetupStepKey = "hours" | "staff" | "pricing";

type OwnerInitialSetupReadiness = {
  shopId: string;
  steps: Record<OwnerInitialSetupStepKey, boolean>;
  completed: boolean;
  nextStep: OwnerInitialSetupStepKey | null;
};

type CanonicalOwnerBootstrapPayload = BootstrapPayload & {
  initialSetupReadiness?: OwnerInitialSetupReadiness;
};

type OwnerInitialSetupState = {
  readiness: OwnerInitialSetupReadiness;
  bootstrap?: BootstrapPayload;
  roleContext: OwnerMobileRoleContext;
};

type OwnerMobileLoadFailure = {
  kind: "account" | "initialization" | "network" | "no-shop" | "server";
  title: string;
  message: string;
  actionLabel: string;
};

const CURRENT_OWNER_SHOP_STORAGE = "petmanager:owner-current-shop";

type OwnerMobileEntryPendingPhotoPrune = typeof pruneExpiredPendingOwnerStatusPhotos;
let ownerMobileEntryPendingPhotoPruneInFlight: ReturnType<OwnerMobileEntryPendingPhotoPrune> | null = null;

function runOwnerMobileEntryPendingPhotoPrune(
  prune: OwnerMobileEntryPendingPhotoPrune = pruneExpiredPendingOwnerStatusPhotos,
) {
  if (ownerMobileEntryPendingPhotoPruneInFlight) return ownerMobileEntryPendingPhotoPruneInFlight;
  const run = prune();
  ownerMobileEntryPendingPhotoPruneInFlight = run;
  void run.then(
    () => {
      if (ownerMobileEntryPendingPhotoPruneInFlight === run) ownerMobileEntryPendingPhotoPruneInFlight = null;
    },
    () => {
      if (ownerMobileEntryPendingPhotoPruneInFlight === run) ownerMobileEntryPendingPhotoPruneInFlight = null;
    },
  );
  return run;
}

function shouldUseLocalMobilePreview() {
  if (typeof window === "undefined") return false;
  if (process.env.NODE_ENV === "production") return false;
  if (window.location.hostname !== "127.0.0.1" && window.location.hostname !== "localhost") return false;
  const params = new URLSearchParams(window.location.search);
  return params.get("preview") === "1" || params.get("preview") === "initial-setup";
}

function shouldPreviewInitialSetupHandoff() {
  if (!shouldUseLocalMobilePreview() || typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "initial-setup";
}

function readOwnerInitialSetupReadiness(
  bootstrap: CanonicalOwnerBootstrapPayload,
  expectedShopId: string,
): OwnerInitialSetupReadiness {
  const readiness = bootstrap.initialSetupReadiness;
  if (
    !readiness ||
    readiness.shopId !== expectedShopId ||
    typeof readiness.completed !== "boolean" ||
    typeof readiness.steps?.hours !== "boolean" ||
    typeof readiness.steps?.staff !== "boolean" ||
    typeof readiness.steps?.pricing !== "boolean" ||
    readiness.completed !== (readiness.steps.hours && readiness.steps.staff && readiness.steps.pricing) ||
    (readiness.nextStep !== null && !["hours", "staff", "pricing"].includes(readiness.nextStep))
  ) {
    throw new Error("매장 초기 설정 상태를 확인하지 못했습니다.");
  }
  return readiness;
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

function getOwnerMobileLoadFailure(error: unknown): OwnerMobileLoadFailure {
  const message = error instanceof Error ? error.message : "";
  const normalizedMessage = message.toLowerCase();
  const isNetworkFailure =
    error instanceof TypeError ||
    normalizedMessage.includes("failed to fetch") ||
    normalizedMessage.includes("load failed") ||
    normalizedMessage.includes("networkerror");

  if (error instanceof ApiRequestError && error.status === 403 && normalizedMessage.includes("일시 중지")) {
    return {
      kind: "account",
      title: "계정 이용이 일시 정지되었습니다",
      message: "로그인 정보와 저장된 데이터는 그대로 유지됩니다. 운영자에게 계정 상태를 문의해 주세요.",
      actionLabel: "다시 확인하기",
    };
  }

  if (message === OWNER_MOBILE_AUTHORITY_ERROR_MESSAGE) {
    return {
      kind: "account",
      title: "계정 권한을 확인하지 못했습니다",
      message: "로그인 정보는 그대로 유지됩니다. 잠시 후 다시 확인해 주세요.",
      actionLabel: "다시 확인하기",
    };
  }

  if (isNetworkFailure) {
    return {
      kind: "network",
      title: "네트워크 연결을 확인해 주세요",
      message: "로그인 정보와 저장된 데이터는 그대로 유지됩니다. 연결을 확인한 뒤 다시 시도해 주세요.",
      actionLabel: "다시 시도하기",
    };
  }

  if (error instanceof ApiRequestError && error.status >= 500) {
    return {
      kind: "server",
      title: "서버 연결이 원활하지 않습니다",
      message: "로그인 정보와 저장된 데이터는 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.",
      actionLabel: "다시 시도하기",
    };
  }

  return {
    kind: "initialization",
    title: "앱을 준비하지 못했습니다",
    message: "로그인 정보와 저장된 데이터는 그대로 유지됩니다. 잠시 후 다시 시도해 주세요.",
    actionLabel: "다시 시도하기",
  };
}

function OwnerMobileLoadingScreen({ message }: { message: string }) {
  return (
    <div
      className="owner-font mx-auto min-h-screen w-full max-w-[430px] bg-[#f7f8fa] px-4 pt-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="animate-pulse rounded-[12px] border border-[#edf1f5] bg-white px-4 py-3.5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-[9px] bg-[#e8eef8]" />
            <span className="h-4 w-28 rounded bg-[#e8edf4]" />
          </div>
          <span className="h-8 w-20 rounded-[10px] bg-[#eef2f7]" />
        </div>
        <div className="mt-4 flex gap-5 border-t border-[#edf1f5] pt-3">
          <span className="h-4 w-14 rounded bg-[#dce8fb]" />
          <span className="h-4 w-16 rounded bg-[#eef2f7]" />
          <span className="h-4 w-14 rounded bg-[#eef2f7]" />
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {["w-full", "w-10/12", "w-8/12"].map((width, index) => (
          <div key={index} className="rounded-[12px] border border-[#edf1f5] bg-white px-4 py-4">
            <div className={`h-4 ${width} animate-pulse rounded bg-[#edf1f5]`} />
            <div className="mt-3 h-3 w-6/12 animate-pulse rounded bg-[#f1f4f8]" />
          </div>
        ))}
      </div>

      <p className="mt-5 text-center text-[13px] tracking-[-0.02em] text-[#718096]">{message}</p>
    </div>
  );
}

function OwnerMobileFailureScreen({
  failure,
  onRetry,
}: {
  failure: OwnerMobileLoadFailure;
  onRetry: () => void;
}) {
  return (
    <main className="owner-font mx-auto flex min-h-screen w-full max-w-[430px] items-center bg-[#f7f8fa] px-5 py-8 text-[#15213b]">
      <section
        className="w-full rounded-[14px] border border-[#e8edf3] bg-white px-5 py-5"
        role="alert"
        aria-labelledby="owner-mobile-load-failure-title"
      >
        <p className="text-[14px] font-medium leading-5 tracking-[-0.005em] text-[#9a5e4e]">확인 필요</p>
        <h1
          id="owner-mobile-load-failure-title"
          className="mt-2 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#15213b]"
        >
          {failure.title}
        </h1>
        <p className="mt-2 text-[16px] font-normal leading-6 text-[#64748b]">{failure.message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-5 flex min-h-[44px] w-full items-center justify-center rounded-[10px] bg-[#111a30] px-4 py-2.5 text-[16px] font-medium leading-6 tracking-[-0.005em] text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb]"
        >
          {failure.actionLabel}
        </button>
      </section>
    </main>
  );
}

export default function OwnerMobilePage() {
  const router = useRouter();
  const initialSetupEntryFinished = useRef(false);
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const requestedOwnerMobilePath = "/owner/mobile";
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
  const [data, setData] = useState<CanonicalOwnerBootstrapPayload | null>(null);
  const [ownedShops, setOwnedShops] = useState<OwnedShopSummary[]>([]);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [subscriptionSummary, setSubscriptionSummary] = useState<OwnerSubscriptionSummary | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [mobileRoleContext, setMobileRoleContext] = useState<OwnerMobileRoleContext>({
    appRole: "owner",
    currentStaffId: null,
  });
  const [initialSetupState, setInitialSetupState] = useState<OwnerInitialSetupState | null>(null);
  const [message, setMessage] = useState("모바일 오너 화면을 불러오는 중입니다.");
  const [loadFailure, setLoadFailure] = useState<OwnerMobileLoadFailure | null>(null);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const ownerAccessGateRef = useRef(createLatestOwnerAccessGate<OwnerMobileAccessContext | null>());
  const ownerMobileEntryPruneStartedRef = useRef(false);

  useEffect(() => {
    if (ownerMobileEntryPruneStartedRef.current) return;
    ownerMobileEntryPruneStartedRef.current = true;
    void runOwnerMobileEntryPendingPhotoPrune().catch(() => {
      ownerMobileEntryPruneStartedRef.current = false;
    });
  }, []);

  function loadOwnerMobileDemoFallback() {
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
    setSubscriptionSummary(null);
    setUserEmail(null);
    setMobileRoleContext({ appRole: "owner", currentStaffId: null });
    if (shouldPreviewInitialSetupHandoff()) {
      setData(null);
      setInitialSetupState({
        roleContext: { appRole: "owner", currentStaffId: null },
        readiness: {
          shopId: demoBootstrap.shop.id,
          steps: { hours: true, staff: false, pricing: false },
          completed: false,
          nextStep: "staff",
        },
      });
      return;
    }
    setData(demoBootstrap);
    setInitialSetupState(null);
  }

  async function getOwnerAccessContext(): Promise<OwnerMobileAccessContext | null> {
    if (!supabase) return null;

    const handoffSession = peekOwnerAuthHandoff();
    if (handoffSession) {
      writeOwnerAuthSessionCache(handoffSession);
      setCurrentOwnerAccessToken(handoffSession.accessToken);
      clearOwnerAuthHandoff();

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

    async function load() {
      setLoadFailure(null);
      setInitialSetupState(null);
      setMessage("모바일 오너 화면을 불러오는 중입니다.");

      if (!hasSupabaseBrowserEnv() || !supabase) {
        if (active && shouldUseLocalMobilePreview()) {
          loadOwnerMobileDemoFallback();
          return;
        }
        router.replace(`/login?next=${encodeURIComponent(requestedOwnerMobilePath)}` as never);
        return;
      }

      try {
        const ownerAccessRun = ownerAccessGateRef.current.begin(getOwnerAccessContext);
        const ownerAccess = await ownerAccessRun.access;
        if (!active || !ownerAccessGateRef.current.isLatest(ownerAccessRun.runId)) return;

        if (!ownerAccess?.accessToken) {
          if (shouldUseLocalMobilePreview()) {
            if (active) loadOwnerMobileDemoFallback();
            return;
          }
          router.replace(`/login?next=${encodeURIComponent(requestedOwnerMobilePath)}` as never);
          return;
        }

        setUserEmail(ownerAccess.session?.user.email ?? null);

        const shops = await fetchApiJsonWithAuth<OwnedShopSummary[]>("/api/owner/shops");
        if (!active) return;
        const storedShopId =
          typeof window !== "undefined" ? window.localStorage.getItem(CURRENT_OWNER_SHOP_STORAGE) : null;
        const resolvedShopId =
          (storedShopId && shops.some((shop) => shop.id === storedShopId) ? storedShopId : shops[0]?.id) ?? null;

        if (!resolvedShopId) {
          setOwnedShops(shops);
          setSelectedShopId(null);
          setLoadFailure({
            kind: "no-shop",
            title: "연결된 매장을 찾지 못했습니다",
            message: "이 계정에 연결된 매장이 없습니다. 매장 등록 상태를 확인한 뒤 다시 시도해 주세요.",
            actionLabel: "다시 확인하기",
          });
          return;
        }

        if (typeof window !== "undefined") {
          window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, resolvedShopId);
        }

        const bootstrap = await fetchApiJsonWithAuth<CanonicalOwnerBootstrapPayload>(
          `/api/bootstrap?shopId=${encodeURIComponent(resolvedShopId)}`,
          { cache: "no-store" },
        );
        if (!active) return;

        const canonicalBootstrap = assertOwnerBootstrapPayload(bootstrap, resolvedShopId, {
          allowMock: shouldUseLocalMobilePreview(),
        });
        const roleContext = resolveOwnerMobileRoleContext(canonicalBootstrap);
        const readiness = readOwnerInitialSetupReadiness(canonicalBootstrap, resolvedShopId);
        setOwnedShops(shops);
        setSelectedShopId(resolvedShopId);
        setMobileRoleContext(roleContext);

        const firstSetupEntry = !initialSetupEntryFinished.current && new URLSearchParams(window.location.search).get("entry") === "initial_setup";
        if (roleContext.appRole === "owner" && firstSetupEntry) {
          setData(null);
          setSubscriptionSummary(null);
          setInitialSetupState({ readiness, roleContext, bootstrap: canonicalBootstrap });
          return;
        }

        const subscription = roleContext.appRole === "owner" && readiness.completed
          ? await fetchApiJsonWithAuth<OwnerSubscriptionSummary>(
              `/api/subscription?shopId=${encodeURIComponent(resolvedShopId)}`,
              { cache: "no-store" },
            )
          : null;
        if (!active) return;

        const isAndroidApp = Capacitor.getPlatform() === "android";
        if (subscription && !isAndroidApp && shouldBlockOwnerAccessBySubscription(subscription)) {
          router.replace(`/owner/billing?compare=1&plan=${encodeURIComponent(subscription.autoRenewPlanCode)}` as never);
          router.refresh();
          return;
        }
        if (subscription) writeOwnerBillingSummaryCache(subscription);

        if (!active) return;
        setData(assertOwnerBootstrapPayload(canonicalBootstrap, resolvedShopId, {
          allowMock: shouldUseLocalMobilePreview(),
        }));
        setSubscriptionSummary(subscription);
      } catch (error) {
        if (!active) return;
        const nextMessage = error instanceof Error ? error.message : "모바일 오너 화면을 불러오지 못했습니다.";

        if (isOwnerAuthRecoveryError(nextMessage)) {
          if (shouldUseLocalMobilePreview()) {
            loadOwnerMobileDemoFallback();
            return;
          }
          clearOwnerAuthTokenCache();
          router.replace(`/login?next=${encodeURIComponent(requestedOwnerMobilePath)}` as never);
          return;
        }

        if (
          Capacitor.getPlatform() !== "android" &&
          (nextMessage.includes("서비스 이용 기간이 만료") || nextMessage.includes("결제 정보를 확인"))
        ) {
          router.replace("/owner/billing?compare=1" as never);
          router.refresh();
          return;
        }

        setLoadFailure(getOwnerMobileLoadFailure(error));
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [loadAttempt, router, supabase]);

  async function handleSwitchShop(shopId: string) {
    if (!shopId || shopId === selectedShopId) return;
    try {
      const nextBootstrap = await fetchApiJsonWithAuth<CanonicalOwnerBootstrapPayload>(
        `/api/bootstrap?shopId=${encodeURIComponent(shopId)}`,
        { cache: "no-store" },
      );
      const canonicalNextBootstrap = assertOwnerBootstrapPayload(nextBootstrap, shopId, {
        allowMock: shouldUseLocalMobilePreview(),
      });
      const nextRoleContext = resolveOwnerMobileRoleContext(canonicalNextBootstrap);
      const nextReadiness = readOwnerInitialSetupReadiness(canonicalNextBootstrap, shopId);
      const nextSubscription = nextReadiness.completed && nextRoleContext.appRole === "owner"
        ? await fetchApiJsonWithAuth<OwnerSubscriptionSummary>(
            `/api/subscription?shopId=${encodeURIComponent(shopId)}`,
            { cache: "no-store" },
          )
        : null;

      if (typeof window !== "undefined") {
        window.localStorage.setItem(CURRENT_OWNER_SHOP_STORAGE, shopId);
      }

      setSelectedShopId(shopId);
      setMobileRoleContext(nextRoleContext);

      if (nextSubscription && Capacitor.getPlatform() !== "android" && shouldBlockOwnerAccessBySubscription(nextSubscription)) {
        writeOwnerBillingSummaryCache(nextSubscription);
        router.replace(`/owner/billing?compare=1&plan=${encodeURIComponent(nextSubscription.autoRenewPlanCode)}` as never);
        router.refresh();
        return;
      }

      if (nextSubscription) writeOwnerBillingSummaryCache(nextSubscription);
      setInitialSetupState(null);
      setData(assertOwnerBootstrapPayload(canonicalNextBootstrap, shopId, {
        allowMock: shouldUseLocalMobilePreview(),
      }));
      setSubscriptionSummary(nextSubscription);
    } catch (error) {
      if (!(error instanceof Error) || error.message !== OWNER_MOBILE_AUTHORITY_ERROR_MESSAGE) throw error;
      setData(null);
      setInitialSetupState(null);
      setLoadFailure(getOwnerMobileLoadFailure(error));
    }
  }

  if (!data) {
    if (initialSetupState) {
      const leaveInitialSetup = () => {
        initialSetupEntryFinished.current = true;
        const url = new URL(window.location.href);
        url.searchParams.delete("entry");
        window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}`);
        setInitialSetupState(null);
        setLoadAttempt((attempt) => attempt + 1);
      };
      return <OwnerInitialSetupFlow key={initialSetupState.readiness.shopId} setup={initialSetupState} onRefresh={() => setLoadAttempt((attempt) => attempt + 1)} onDefer={leaveInitialSetup} onFinish={leaveInitialSetup} />;
    }
    if (loadFailure) {
      return <OwnerMobileFailureScreen failure={loadFailure} onRetry={() => setLoadAttempt((attempt) => attempt + 1)} />;
    }
    return <OwnerMobileLoadingScreen message={message} />;
  }

  return (
    <>
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
      {mobileRoleContext.appRole === "owner" && data.initialSetupReadiness?.completed === false ? (
        <aside className="pointer-events-none fixed inset-x-3 top-3 z-40 mx-auto flex max-w-[404px] justify-end" aria-label="초기 설정 안내">
          <button
            type="button"
            className="pointer-events-auto min-h-11 rounded-[10px] border border-[#c7ddff] bg-white px-3 text-[14px] font-medium text-[#174ea6] shadow-[0_2px_10px_rgba(15,23,42,0.12)]"
            onClick={() => {
              const readiness = readOwnerInitialSetupReadiness(data, data.shop.id);
              setData(null);
              setSubscriptionSummary(null);
              setInitialSetupState({ readiness, roleContext: mobileRoleContext, bootstrap: data });
            }}
          >
            초기 설정 이어하기
          </button>
        </aside>
      ) : null}
    </>
  );
}
