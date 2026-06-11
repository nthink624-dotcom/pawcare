"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
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
  PAGE_EYEBROW,
  PAGE_FRAME,
  PAGE_TITLE,
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

function normalizePhone(value: string) {
  return value.replace(/\D/g, "").slice(0, 11);
}

function formatPhone(value: string) {
  const digits = normalizePhone(value);
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
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[16px] font-medium text-[#3d3833]">{label}</span>
        {hint ? <span className="text-[14px] text-[#8b847b]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className={cn(INPUT_BASE, "h-[56px] rounded-[14px] px-5 text-[18px]")}
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
  const [shopName, setShopName] = useState("");
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

      if (typeof window !== "undefined") {
        window.localStorage.removeItem(PENDING_SOCIAL_PROVIDER_STORAGE);
      }
    }

    void syncUser();
  }, [nextPath, router, supabase]);

  const providerLabel = resolvedProvider ? providerLabelMap[resolvedProvider] : "소셜";
  const isFormValid =
    ownerName.trim().length > 0 &&
    /^01\d{8,9}$/.test(phoneNumber) &&
    shopName.trim().length > 0 &&
    shopAddress.trim().length > 0;

  const handleSubmit = async () => {
    if (loading) return;

    if (!ownerName.trim()) {
      setMessage("이름을 입력해 주세요.");
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
      window.location.assign(nextPath);
    } catch {
      setMessage("기본 정보를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={cn(PAGE_FRAME, "bg-white px-6 pb-8 pt-7 text-[#111111]")}>
        <div className="space-y-7">
          <MobileBackLinkButton href="/login" replace aria-label="로그인으로 돌아가기" />

          <div className="space-y-2">
            <p className={cn(PAGE_EYEBROW, "text-[16px]")}>{providerLabel} 회원가입</p>
            <h1 className={cn(PAGE_TITLE, "text-[34px] leading-[1.18]")}>기본 정보를 입력해 주세요</h1>
          </div>
        </div>

        <div className="mt-9 space-y-7">
          <div className="space-y-5">
            <FormField label="이름">
              <TextInput value={ownerName} onChange={setOwnerName} placeholder="대표자 이름을 입력해 주세요" />
            </FormField>

            <FormField label="휴대폰번호">
              <TextInput
                value={formatPhone(phoneNumber)}
                onChange={(value) => setPhoneNumber(normalizePhone(value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
              />
            </FormField>

            <FormField label="매장명">
              <TextInput value={shopName} onChange={setShopName} placeholder="매장 이름을 입력해 주세요" />
            </FormField>

            <FormField label="매장 주소">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(true)}
                  className={cn(
                    INPUT_BASE,
                    "flex h-auto min-h-[56px] items-center justify-between gap-3 rounded-[14px] px-5 py-3 text-left text-[18px]",
                  )}
                >
                  <div className="min-w-0">
                    <span className={shopAddress ? "block truncate text-[#111827]" : "block truncate text-[#b0b7bf]"}>
                      {shopAddress || "주소 검색으로 매장 주소를 선택해 주세요"}
                    </span>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold text-[#1f6b5b]">주소 검색</span>
                </button>

                <TextInput
                  value={shopDetailAddress}
                  onChange={setShopDetailAddress}
                  placeholder="상세 주소를 입력해 주세요"
                />
              </div>
            </FormField>
          </div>

          {message ? <p className={INLINE_ERROR}>{message}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="flex h-[60px] w-full items-center justify-center rounded-[14px] bg-[#2f7866] px-5 text-[19px] font-semibold text-white transition disabled:cursor-not-allowed disabled:bg-[#9fc6ba]"
          >
            <span>{loading ? "저장 중..." : "무료체험 시작하기"}</span>
            {!loading ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
          </button>
        </div>
      </div>

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
