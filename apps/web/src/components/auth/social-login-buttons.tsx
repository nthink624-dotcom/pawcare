"use client";

import { useEffect, useRef, useState } from "react";

import { getSocialLoginCallbackUrl, readSocialLoginAvailability, SOCIAL_LOGIN_PROVIDERS, type SocialLoginProvider } from "@/lib/auth/social-login";
import { env } from "@/lib/env";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function ProviderIcon({ provider }: { provider: SocialLoginProvider }) {
  if (provider === "naver") return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="currentColor" d="M15.5 3v9.63L8.5 3H2v18h6.5v-9.63l7 9.63H22V3z" /></svg>;
  if (provider === "kakao") return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="currentColor" d="M12 3C5.92 3 1 6.83 1 11.55c0 3.05 2.06 5.73 5.16 7.24l-1.05 3.86c-.09.34.3.61.59.41l4.62-3.07c.55.07 1.11.11 1.68.11 6.08 0 11-3.83 11-8.55S18.08 3 12 3Z" /></svg>;
  return <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.24c1.9-1.75 2.98-4.33 2.98-7.36Z" /><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.41l-3.24-2.51c-.9.6-2.04.97-3.38.97-2.61 0-4.83-1.76-5.62-4.12H3.04v2.59A10 10 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.38 13.93A6 6 0 0 1 6.05 12c0-.67.12-1.32.33-1.93V7.48H3.04A10 10 0 0 0 2 12c0 1.61.39 3.14 1.04 4.52l3.34-2.59Z" /><path fill="#EA4335" d="M12 5.95c1.47 0 2.79.5 3.82 1.5l2.86-2.86A9.59 9.59 0 0 0 12 2a10 10 0 0 0-8.96 5.48l3.34 2.59C7.17 7.71 9.39 5.95 12 5.95Z" /></svg>;
}

const providerStyles = {
  naver: "border-[#03c75a] bg-[#03c75a] text-white hover:bg-[#02b350]",
  kakao: "border-[#fee500] bg-[#fee500] text-[#191919] hover:bg-[#f5dc00]",
  google: "border-[#dadce0] bg-white text-[#3c4043] hover:bg-[#f8fafd]",
};

export default function SocialLoginButtons({ nextPath, disabled, onPendingChange }: {
  nextPath: string;
  disabled: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const [pending, setPending] = useState<SocialLoginProvider | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const inFlight = useRef(false);

  useEffect(() => {
    const reset = () => { inFlight.current = false; setPending(null); onPendingChange(false); };
    window.addEventListener("pageshow", reset);
    return () => window.removeEventListener("pageshow", reset);
  }, [onPendingChange]);

  async function startLogin(id: SocialLoginProvider) {
    if (disabled || inFlight.current) return;
    const provider = SOCIAL_LOGIN_PROVIDERS.find((item) => item.id === id)!;
    inFlight.current = true;
    setPending(id);
    onPendingChange(true);
    setMessage(null);
    let navigating = false;
    try {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) throw new Error("unavailable");
      const availability = await readSocialLoginAvailability();
      if (availability[id] !== true) {
        setMessage(`${provider.label} 로그인은 현재 준비 중입니다. 이메일로 로그인해 주세요.`);
        return;
      }
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: provider.provider,
        options: { redirectTo: getSocialLoginCallbackUrl(window.location.origin, nextPath), skipBrowserRedirect: true },
      });
      if (error || !data.url || !env.supabaseUrl) throw new Error("unavailable");
      const destination = new URL(data.url);
      if (destination.origin !== new URL(env.supabaseUrl).origin || destination.pathname !== "/auth/v1/authorize") throw new Error("unavailable");
      window.location.assign(destination.toString());
      navigating = true;
    } catch {
      setMessage(`${provider.label} 로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.`);
    } finally {
      if (!navigating) { inFlight.current = false; setPending(null); onPendingChange(false); }
    }
  }

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3 text-[13px] leading-5 text-[#64748b]"><span className="h-px flex-1 bg-[#e8edf3]" /><span>간편 로그인</span><span className="h-px flex-1 bg-[#e8edf3]" /></div>
      <div className="grid gap-2.5" aria-label="소셜 로그인">
        {SOCIAL_LOGIN_PROVIDERS.map(({ id, label }) => (
          <button key={id} data-testid={`social-login-${id}`} type="button" disabled={disabled || pending !== null} aria-busy={pending === id} onClick={() => void startLogin(id)} className={`grid min-h-12 w-full grid-cols-[20px_minmax(0,1fr)_20px] items-center gap-3 rounded-[10px] border px-4 py-3 text-[16px] font-medium leading-6 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:cursor-wait disabled:opacity-60 ${providerStyles[id]}`}>
            <ProviderIcon provider={id} />
            <span>{pending === id ? `${label} 로그인 연결 중…` : `${label}로 로그인`}</span>
            <span aria-hidden="true" />
          </button>
        ))}
      </div>
      {message ? <p role="alert" className="mt-3 break-keep text-[13px] leading-5 text-[#9a5e4e]">{message}</p> : null}
    </div>
  );
}
