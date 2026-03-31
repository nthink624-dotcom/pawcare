"use client";

import type { ReactNode } from "react";

type SocialProvider = "google" | "kakao" | "naver";

const providerMeta: Record<SocialProvider, { label: string; icon: ReactNode; enabled: boolean }> = {
  google: {
    label: "Google로 계속하기",
    icon: <span className="text-[20px] font-bold text-[#4285F4]">G</span>,
    enabled: true,
  },
  kakao: {
    label: "카카오로 계속하기",
    icon: <span className="text-[15px] font-black text-[#191600]">K</span>,
    enabled: true,
  },
  naver: {
    label: "네이버로 계속하기",
    icon: <span className="text-[15px] font-black text-white">N</span>,
    enabled: false,
  },
};

export default function SocialLoginButtons({
  onLogin,
  loadingProvider,
  disabled,
}: {
  onLogin: (provider: SocialProvider) => void;
  loadingProvider: SocialProvider | null;
  disabled: boolean;
}) {
  return (
    <div className="space-y-3">
      {(["google", "kakao", "naver"] as const).map((provider) => {
        const meta = providerMeta[provider];
        const isLoading = loadingProvider === provider;
        const isDisabled = disabled || isLoading || !meta.enabled;
        const iconBg = provider === "kakao" ? "#FEE500" : provider === "naver" ? "#03C75A" : "transparent";

        return (
          <button
            key={provider}
            type="button"
            onClick={() => meta.enabled && onLogin(provider)}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            className="flex h-[54px] w-full items-center justify-center gap-3.5 rounded-[18px] border border-[#bfc7d0] bg-white px-5 text-[15px] font-semibold text-[#111111] transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full" style={{ backgroundColor: iconBg }}>
              {meta.icon}
            </span>
            <span>{isLoading ? "연결 중..." : meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

