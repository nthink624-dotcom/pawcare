"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";

import KakaoPostcodeSheet from "@/components/ui/kakao-postcode-sheet";
import { MobileBackLinkButton } from "@/components/ui/mobile-back-button";
import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import {
  INLINE_ERROR,
  INPUT_BASE,
  cn,
} from "@/lib/ui-system";
import { getSupabaseOAuthBrowserClient } from "@/lib/supabase/client";

const AGREEMENTS = {
  service: true,
  privacy: true,
  location: false,
  marketing: false,
};

const providerLabelMap: Record<SocialProvider, string> = {
  google: "Google",
  kakao: "카카오",
  naver: "네이버",
};

const providerVisuals: Record<
  SocialProvider,
  {
    gradient: string;
    logoSrc: string;
    decorativeLogoSrc?: string;
    logoClassName: string;
  }
> = {
  kakao: {
    gradient: "linear-gradient(180deg, #fff3b0 0%, #ffffff 100%)",
    logoSrc: "/icons/social/kakaotalk_sharing_btn_medium.png",
    decorativeLogoSrc: "/images/auth/kakao-symbol.png",
    logoClassName: "h-[38px] w-[38px] rounded-[10px]",
  },
  naver: {
    gradient: "linear-gradient(180deg, #c9f3da 0%, #ffffff 100%)",
    logoSrc: "/images/auth/naver-login-light-kr-green-wide-h48.png",
    logoClassName: "h-[38px] w-[38px] rounded-full",
  },
  google: {
    gradient: "linear-gradient(180deg, #eef2fb 0%, #ffffff 100%)",
    logoSrc: "/images/auth/google-symbol.png",
    logoClassName: "h-[34px] w-[34px]",
  },
};

function ProviderLogo({
  provider,
  decorative = false,
}: {
  provider?: SocialProvider;
  decorative?: boolean;
}) {
  if (!provider) return null;

  const visual = providerVisuals[provider];
  return (
    <Image
      src={decorative ? (visual.decorativeLogoSrc ?? visual.logoSrc) : visual.logoSrc}
      alt={decorative ? "" : `${providerLabelMap[provider]} 로고`}
      width={decorative ? 130 : 24}
      height={decorative ? 130 : 24}
      className={
        decorative
          ? "h-[130px] w-[130px] object-contain"
          : cn("object-contain", visual.logoClassName)
      }
      aria-hidden={decorative}
    />
  );
}

function normalizePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const domesticDigits = digits.startsWith("82") ? `0${digits.slice(2)}` : digits;
  return domesticDigits.slice(0, 11);
}

function normalizeShopPhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function isValidShopPhone(value: string) {
  return /^(?:02\d{7,8}|0[3-6]\d{7,8}|070\d{7,8}|050\d{8}|01\d{8,9})$/.test(value);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function formatShopPhone(value: string) {
  const digits = normalizeShopPhone(value);
  if (digits.startsWith("02")) {
    if (digits.length < 3) return digits;
    if (digits.length <= 6) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    if (digits.length <= 9) return `${digits.slice(0, 2)}-${digits.slice(2, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 6)}-${digits.slice(6, 10)}`;
  }
  if (digits.length < 4) return digits;
  if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  if (digits.length < 11) return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7, 11)}`;
}

function readMetadataValue(source: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!source) return "";

  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function joinAddress(baseAddress: string, detailAddress: string) {
  return [baseAddress.trim(), detailAddress.trim()].filter(Boolean).join(" ");
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-[14px] block">
      <label className="mb-1.5 block text-[12.5px] font-semibold text-[#64748b]">{label}</label>
      {children}
    </div>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
  disabled = false,
  readOnly = false,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
  readOnly?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={disabled}
      readOnly={readOnly}
      className={cn(
        INPUT_BASE,
        "h-12 rounded-[11px] border-[#e5e9f0] bg-[#f8fafc] px-[14px] text-[13.5px] font-normal text-[#0f172a] placeholder:text-[#b0b8c4] focus:border-[#0f172a] focus:bg-white focus:ring-0 disabled:bg-[#f8fafc] disabled:text-[#64748b] read-only:cursor-default read-only:bg-[#f8fafc]",
      )}
    />
  );
}

export default function SocialSignupCompleteForm({
  nextPath = "/owner",
  provider,
}: {
  nextPath?: string;
  provider?: SocialProvider;
}) {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseOAuthBrowserClient(), []);

  const [resolvedProvider, setResolvedProvider] = useState<SocialProvider | undefined>(provider);
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [email, setEmail] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopPhoneNumber, setShopPhoneNumber] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [shopDetailAddress, setShopDetailAddress] = useState("");
  const [shopPostalCode, setShopPostalCode] = useState("");
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const pendingProvider =
      typeof window !== "undefined" ? window.localStorage.getItem(PENDING_SOCIAL_PROVIDER_STORAGE) : null;

    async function syncUser() {
      if (!supabase) return;

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("소셜 로그인 정보를 확인하지 못했어요. 로그인 화면에서 다시 시도해 주세요.");
        return;
      }

      const session = await supabase.auth.getSession();
      const accessToken = session.data.session?.access_token;
      if (accessToken) {
        try {
          const response = await fetch("/api/owner/shops", {
            cache: "no-store",
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          });
          const shops = response.ok ? await response.json() : [];
          if (Array.isArray(shops) && shops.length > 0) {
            router.replace(nextPath as never);
            return;
          }
        } catch {
          // Existing-shop detection is only a convenience; keep the social signup form usable.
        }
      }

      const detectedProvider =
        pendingProvider === "google" || pendingProvider === "kakao" || pendingProvider === "naver"
          ? pendingProvider
          : resolveSocialProviderFromAuthUser(user);

      setResolvedProvider(detectedProvider);
      setOwnerName((prev) => prev || readMetadataValue(user.user_metadata, ["name", "full_name", "nickname", "given_name"]));
      setPhoneNumber(
        (prev) =>
          prev ||
          normalizePhone(readMetadataValue(user.user_metadata, ["phone", "phone_number", "phoneNumber"]) || user.phone || ""),
      );
      setEmail((previous) => previous || user.email || "");

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_SOCIAL_PROVIDER_STORAGE);
      }
    }

    void syncUser();
  }, [nextPath, router, supabase]);

  const providerLabel = resolvedProvider ? providerLabelMap[resolvedProvider] : "소셜";
  const providerVisual = resolvedProvider ? providerVisuals[resolvedProvider] : null;
  const phoneIsEditable = resolvedProvider === "google";

  const handleSubmit = async () => {
    if (loading) return;

    if (!ownerName.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!email.trim()) {
      setMessage("소셜 계정의 이메일 정보를 확인하지 못했어요. 다시 로그인해 주세요.");
      return;
    }

    if (!/^01\d{8,9}$/.test(phoneNumber)) {
      setMessage("휴대폰번호를 다시 확인해 주세요.");
      return;
    }

    if (!shopName.trim()) {
      setMessage("매장명을 입력해 주세요.");
      return;
    }

    if (!isValidShopPhone(shopPhoneNumber)) {
      setMessage("매장 연락처를 다시 확인해 주세요.");
      return;
    }

    if (!shopAddress.trim()) {
      setMessage("매장 주소를 선택해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const session = await supabase?.auth.getSession();
      const accessToken = session?.data.session?.access_token;
      if (!accessToken) {
        setMessage("로그인 정보를 확인하지 못했어요. 소셜 로그인을 다시 진행해 주세요.");
        return;
      }

      const response = await fetch("/api/auth/social-complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          phoneNumber,
          shopName: shopName.trim(),
          shopPhoneNumber,
          shopAddress: joinAddress(shopAddress, shopDetailAddress),
          agreements: AGREEMENTS,
          termsVersion: OWNER_SIGNUP_TERMS_VERSION,
        }),
      });

      const result = (await response.json()) as { message?: string };
      if (!response.ok) {
        setMessage(result.message ?? "기본 정보를 저장하지 못했어요. 다시 시도해 주세요.");
        return;
      }

      await supabase?.auth.refreshSession();
      window.location.assign(`/signup/social/complete?next=${encodeURIComponent(nextPath)}`);
    } catch {
      setMessage("기본 정보를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <main className="owner-font mx-auto min-h-screen w-full max-w-[390px] overflow-hidden bg-white text-[#0f172a] sm:min-h-0 sm:rounded-[28px] sm:shadow-[0_20px_60px_rgba(15,23,42,0.14)]">
        <header
          className="relative overflow-hidden px-6 pb-5 pt-[18px]"
          style={{ background: providerVisual?.gradient ?? "linear-gradient(180deg, #f1f5f9 0%, #ffffff 100%)" }}
        >
          <div className="pointer-events-none absolute -right-[18px] -top-[18px] z-0 opacity-[0.16]">
            <ProviderLogo provider={resolvedProvider} decorative />
          </div>

          <MobileBackLinkButton
            href="/login"
            replace
            aria-label="로그인으로 돌아가기"
            className="relative z-10 mb-[14px] h-8 w-8 rounded-[9px] border-0 bg-white/60 text-[#0f172a] shadow-none hover:bg-white/80 [&_svg]:h-[15px] [&_svg]:w-[15px]"
          />

          <div className="relative z-10 flex items-center gap-[14px]">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center">
              <ProviderLogo provider={resolvedProvider} />
            </div>
            <div>
              <h1 className="mb-1 text-[17px] font-extrabold leading-tight text-[#0f172a]">
                {ownerName.trim() ? `${ownerName.trim()}님, 반가워요!` : "반가워요!"}
              </h1>
              <p className="text-[12px] leading-[1.45] text-[#475569]">
                {providerLabel} 계정 정보로 빠르게 가입할게요.
                <br />
                매장 정보만 입력하면 끝나요.
              </p>
            </div>
          </div>
        </header>

        <div className="px-7 pb-9 pt-1">
          <div className="mb-2.5 flex h-[50px] items-center justify-between rounded-[12px] border border-[#eef1f5] bg-[#f8fafc] px-[14px]">
            <span className="mr-2.5 shrink-0 text-[12px] font-semibold text-[#94a3b8]">이름</span>
            <span className="truncate text-[13.5px] font-semibold text-[#0f172a]">
              {ownerName.trim() || "이름 확인 중"}
            </span>
          </div>

          <div className="flex h-[50px] items-center justify-between rounded-[12px] border border-[#eef1f5] bg-[#f8fafc] px-[14px]">
            <span className="mr-2.5 shrink-0 text-[12px] font-semibold text-[#94a3b8]">휴대폰번호</span>
            {phoneIsEditable ? (
              <input
                value={formatPhone(phoneNumber)}
                onChange={(event) => setPhoneNumber(normalizePhone(event.target.value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
                aria-label="휴대폰번호"
                className="w-[140px] border-0 bg-transparent p-0 text-right text-[13.5px] font-semibold text-[#0f172a] outline-none placeholder:font-medium placeholder:text-[#b0b8c4]"
              />
            ) : (
              <span className="whitespace-nowrap text-[13.5px] font-semibold text-[#0f172a]">
                {formatPhone(phoneNumber) || "번호 확인 중"}
              </span>
            )}
          </div>

          <section className="mt-[22px] border-t border-[#eef1f5] pt-5">
            <h2 className="mb-[14px] text-[15px] font-extrabold text-[#0f172a]">매장 정보</h2>
            <FormField label="매장명">
              <TextInput value={shopName} onChange={setShopName} placeholder="매장 이름을 입력해 주세요" />
            </FormField>

            <FormField label="매장 연락처">
              <TextInput
                value={formatShopPhone(shopPhoneNumber)}
                onChange={(value) => setShopPhoneNumber(normalizeShopPhone(value))}
                placeholder="02-0000-0000"
                inputMode="numeric"
              />
            </FormField>

            <FormField label="매장 주소">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(true)}
                  className="h-12 min-w-0 flex-1 truncate rounded-[11px] border border-[#e5e9f0] bg-[#f8fafc] px-[14px] text-left text-[13.5px] text-[#0f172a] outline-none transition hover:bg-white focus:border-[#0f172a]"
                >
                  <span className={shopAddress ? "block truncate" : "block truncate text-[#b0b8c4]"}>
                    {shopAddress || "매장 주소를 입력해 주세요"}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(true)}
                  className="h-12 shrink-0 whitespace-nowrap rounded-[11px] border border-[#0f172a] bg-white px-4 text-[12.5px] font-bold text-[#0f172a] transition hover:bg-[#f8fafc]"
                >
                  주소 검색
                </button>
              </div>
            </FormField>

            <TextInput
              value={shopDetailAddress}
              onChange={setShopDetailAddress}
              placeholder="상세 주소를 입력해 주세요"
            />
          </section>

          {message ? <p className={INLINE_ERROR}>{message}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            aria-disabled={loading}
            className="mt-[22px] flex h-[52px] w-full items-center justify-center gap-1.5 rounded-[13px] bg-[#334155] px-5 text-[14.5px] font-semibold text-white transition hover:bg-[#293548] aria-disabled:cursor-wait aria-disabled:bg-[#334155] aria-disabled:text-white"
          >
            <span>{loading ? "저장 중..." : "무료체험 시작하기"}</span>
            {!loading ? <ChevronRight className="h-[15px] w-[15px]" /> : null}
          </button>
        </div>
      </main>

      {addressSheetOpen ? (
        <KakaoPostcodeSheet
          title="매장 주소 검색"
          description="도로명, 건물명, 지번으로 검색한 뒤 매장 주소를 선택해 주세요."
          initialQuery={shopAddress}
          onClose={() => setAddressSheetOpen(false)}
          onSelect={(selection) => {
            setShopAddress(selection.address);
            setShopPostalCode(selection.zonecode);
            setAddressSheetOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
