"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { clearPendingSocialAccountLink, getSocialLinkCallbackUrl, getSocialProvider, isSafeSocialLinkRedirect, readSocialAccountResources, SOCIAL_ACCOUNT_PATH, writePendingSocialAccountLink } from "@/lib/auth/social-account-link";
import { readOwnerAuthRefreshTokenCache, readOwnerAuthTokenCache, trackOwnerAuthHydration, waitForOwnerAuthHydration } from "@/lib/auth/owner-auth-handoff";
import { SOCIAL_LOGIN_PROVIDERS, type SocialLoginAvailability, type SocialLoginProvider } from "@/lib/auth/social-login";
import { env } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const errors: Record<string, string> = {
  cancelled: "계정 연결이 취소되었습니다. 다시 연결할 수 있습니다.",
  "already-linked": "이 소셜 계정은 다른 펫매니저 계정에 연결되어 있습니다. 계정 정보를 확인해 주세요.",
  expired: "연결 시간이 지났습니다. 아래에서 다시 연결해 주세요.",
  failed: "계정을 연결하지 못했습니다. 다시 시도해 주세요.",
};

type Account = { userId: string; email: string; providers: string[]; availability: SocialLoginAvailability };

class AccountSignInRequired extends Error {}

async function loadAccount(): Promise<Account> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) throw new Error("unavailable");
  await waitForOwnerAuthHydration();
  let sessionResult = await supabase.auth.getSession();
  if (!sessionResult.data.session) {
    const accessToken = readOwnerAuthTokenCache();
    const refreshToken = readOwnerAuthRefreshTokenCache();
    if (accessToken && refreshToken) {
      await trackOwnerAuthHydration(supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken }));
      sessionResult = await supabase.auth.getSession();
    }
  }
  const { data: userData, error: userError } = await supabase.auth.getUser();
  const session = sessionResult.data.session;
  if (userError || !userData.user || !session || session.user.id !== userData.user.id) throw new AccountSignInRequired();
  const availability = await readSocialAccountResources(session.access_token);
  return {
    userId: userData.user.id, email: userData.user.email ?? "",
    providers: (userData.user.identities ?? []).map((identity: { provider: string }) => identity.provider),
    availability,
  };
}

export default function SocialAccountConnections() {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<SocialLoginProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inFlight = useRef(false);
  const accountLoad = useRef<Promise<Account> | null>(null);

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    if (error) setMessage(errors[error] ?? errors.failed);
    accountLoad.current ??= loadAccount();
    void accountLoad.current.then(loaded => {
        if (!active) return;
        const requested = SOCIAL_LOGIN_PROVIDERS.find(item => item.id === getSocialProvider(params.get("provider")));
        setSuccess(params.get("message") === "connected" && !!requested && loaded.providers.includes(requested.provider));
        setAccount(loaded);
      }).catch((error: unknown) => {
        if (!active) return;
        if (error instanceof AccountSignInRequired) window.location.replace(`/login?next=${encodeURIComponent(SOCIAL_ACCOUNT_PATH)}`);
        else setMessage("계정 정보를 확인하지 못했습니다. 로그인 상태를 확인하고 다시 열어 주세요.");
      }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function connect(id: SocialLoginProvider) {
    if (!account || inFlight.current) return;
    inFlight.current = true;
    setPending(id);
    setMessage(null);
    setSuccess(false);
    let navigating = false;
    try {
      const provider = SOCIAL_LOGIN_PROVIDERS.find(item => item.id === id)!;
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !account.availability[id]) throw new Error("unavailable");
      const { data: current, error: userError } = await supabase.auth.getUser();
      if (userError || current.user?.id !== account.userId) throw new Error("unavailable");
      writePendingSocialAccountLink(window.sessionStorage, current.user.id, id);
      const { data, error } = await supabase.auth.linkIdentity({
        provider: provider.provider,
        options: { redirectTo: getSocialLinkCallbackUrl(window.location.origin, id), skipBrowserRedirect: true },
      });
      if (error || !data.url || !env.supabaseUrl) throw new Error("unavailable");
      if (!isSafeSocialLinkRedirect(data.url, id, env.supabaseUrl)) throw new Error("unavailable");
      window.location.assign(data.url);
      navigating = true;
    } catch {
      clearPendingSocialAccountLink(window.sessionStorage);
      setMessage("계정 연결을 시작하지 못했습니다. 로그인 상태를 확인하고 다시 시도해 주세요.");
    } finally { if (!navigating) { inFlight.current = false; setPending(null); } }
  }

  return <main className="min-h-dvh bg-[#f1f3f7] px-5 py-8 text-[#101a31] sm:py-12">
    <section className="mx-auto w-full max-w-xl rounded-[18px] bg-white p-5 sm:p-8">
      <Link href="/owner" className="mb-5 inline-flex min-h-12 items-center text-[14px] font-medium text-[#64748b] underline-offset-4 hover:underline">매장으로 돌아가기</Link>
      <h1 className="text-[24px] font-semibold leading-9">소셜 로그인 연결</h1>
      <p className="mt-2 break-keep text-[16px] leading-6 text-[#64748b]">계정을 연결하면 같은 매장을 네이버·카카오·구글로 이용할 수 있습니다.</p>
      {loading ? <p role="status" className="mt-6 text-[14px] leading-6 text-[#64748b]">로그인 계정을 확인하고 있습니다.</p> : null}
      {account ? <>
        <div className="mt-6 border-b border-[#e8edf3] pb-5"><p className="text-[14px] text-[#64748b]">현재 로그인한 계정</p><p data-testid="social-link-current-email" className="mt-1 break-all text-[16px] leading-6">{account.email}</p></div>
        <div className="mt-3 divide-y divide-[#e8edf3]">
          {SOCIAL_LOGIN_PROVIDERS.map(({ id, label, provider }) => {
            const linked = account.providers.includes(provider);
            return <div key={id} className="flex min-h-20 items-center justify-between gap-4 py-3">
              <span className="text-[16px] font-medium">{label}</span>
              <button data-testid={`social-link-${id}`} type="button" onClick={() => void connect(id)} disabled={linked || pending !== null || !account.availability[id]} aria-busy={pending === id} className="min-h-12 shrink-0 rounded-[10px] border border-[#dbe2ea] bg-white px-4 text-[14px] font-medium leading-5 text-[#101a31] hover:bg-[#f8fafc] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:text-[#64748b]">
                {linked ? "연결됨" : pending === id ? "연결 준비 중…" : account.availability[id] ? "연결하기" : "준비 중"}
              </button>
            </div>;
          })}
        </div>
      </> : null}
      {success && account ? <p role="status" className="mt-4 text-[14px] leading-6 text-[#1f6b5b]">소셜 계정이 연결되었습니다.</p> : null}
      {message ? <p role="alert" className="mt-4 break-keep text-[14px] leading-6 text-[#9a5e4e]">{message}</p> : null}
    </section>
  </main>;
}
