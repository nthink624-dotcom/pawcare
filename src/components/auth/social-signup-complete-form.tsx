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
  PAGE_EYEBROW,
  PAGE_FRAME,
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

function GoogleSymbol() {
  return (
    <svg viewBox="0 0 18 18" aria-hidden="true" className="h-[18px] w-[18px]">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H1v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.41 5.41 0 0 1 3.69 9c0-.6.1-1.18.28-1.72V4.95H1A9 9 0 0 0 0 9c0 1.45.35 2.82 1 4.05l2.97-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.33l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 1 4.95l2.97 2.33c.71-2.12 2.69-3.7 5.03-3.7Z"
      />
    </svg>
  );
}

function ProviderLogo({ provider }: { provider?: SocialProvider }) {
  if (provider === "google") return <GoogleSymbol />;

  if (provider === "kakao") {
    return <Image src="/images/auth/kakao-symbol.png" alt="" width={18} height={18} className="h-[18px] w-[18px]" />;
  }

  if (provider === "naver") {
    return <Image src="/images/auth/naver-symbol.png" alt="" width={18} height={18} className="h-[18px] w-[18px]" />;
  }

  return null;
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
  hint,
  children,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="block">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[16px] font-medium text-[#3d3833]">{label}</span>
        {hint ? <span className="text-[14px] text-[#8b847b]">{hint}</span> : null}
      </div>
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
        "h-[58px] rounded-[12px] border-[#d9dee7] px-5 text-[18px] font-medium focus:border-[#111827] focus:ring-[#111827]/8 disabled:bg-[#f6f7f9] disabled:text-[#6b7280] read-only:cursor-default read-only:bg-[#f8fafc]",
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
  const [shopPhoneSameAsOwner, setShopPhoneSameAsOwner] = useState(false);
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

  useEffect(() => {
    if (shopPhoneSameAsOwner) {
      setShopPhoneNumber(phoneNumber);
    }
  }, [phoneNumber, shopPhoneSameAsOwner]);

  const providerLabel = resolvedProvider ? providerLabelMap[resolvedProvider] : "소셜";

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
      <div className={cn(PAGE_FRAME, "bg-white px-6 pb-8 pt-7 text-[#111111]")}>
        <div className="relative flex h-9 items-center justify-center">
          <MobileBackLinkButton
            href="/login"
            replace
            aria-label="로그인으로 돌아가기"
            className="absolute left-0 h-9 w-9 rounded-[10px] bg-white shadow-none"
          />
          <div className="flex items-center justify-center gap-2">
            <ProviderLogo provider={resolvedProvider} />
            <p className={cn(PAGE_EYEBROW, "text-[16px] font-medium text-[#6b7280]")}>{providerLabel} 간편가입</p>
          </div>
        </div>

        <div className="mt-6 space-y-7">
          <div className="space-y-5">
            <h1 className="text-[17px] font-semibold text-[#111827]">계정 정보</h1>
            <FormField label="이름">
              <TextInput value={ownerName} onChange={setOwnerName} placeholder="대표자 이름을 입력해 주세요" readOnly />
            </FormField>

            <FormField label="휴대폰번호">
              <TextInput
                value={formatPhone(phoneNumber)}
                onChange={(value) => setPhoneNumber(normalizePhone(value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
                readOnly
              />
            </FormField>

            <FormField label="이메일">
              <TextInput value={email} onChange={() => undefined} placeholder="이메일 주소" readOnly />
            </FormField>

            <div className="h-px bg-[#e5e7eb]" aria-hidden="true" />
            <h2 className="text-[17px] font-semibold text-[#111827]">매장 정보</h2>

            <FormField label="매장명">
              <TextInput value={shopName} onChange={setShopName} placeholder="매장 이름을 입력해 주세요" />
            </FormField>

            <FormField
              label="매장 연락처"
              hint={
                <label className="flex items-center gap-1.5 text-[14px] text-[#6b7280]">
                  <input
                    type="checkbox"
                    checked={shopPhoneSameAsOwner}
                    onChange={(event) => {
                      setShopPhoneSameAsOwner(event.target.checked);
                      if (event.target.checked) {
                        setShopPhoneNumber(phoneNumber);
                      }
                    }}
                    className="h-[15px] w-[15px] rounded border-[#cbd5e1] accent-[#111827]"
                  />
                  <span>휴대폰 번호와 같습니다.</span>
                </label>
              }
            >
              <TextInput
                value={formatShopPhone(shopPhoneNumber)}
                onChange={(value) => setShopPhoneNumber(normalizeShopPhone(value))}
                placeholder="02-0000-0000"
                inputMode="numeric"
                disabled={shopPhoneSameAsOwner}
              />
            </FormField>

            <FormField label="매장 주소">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(true)}
                  className={cn(
                    INPUT_BASE,
                    "flex h-auto min-h-[58px] items-center justify-between gap-3 rounded-[12px] border-[#d9dee7] px-5 py-3 text-left text-[18px] font-medium transition hover:bg-[#f7f8fa] focus:border-[#111827] focus:ring-[#111827]/8",
                  )}
                >
                  <div className="min-w-0">
                    <span className={shopAddress ? "block truncate text-[#111827]" : "block truncate text-[#b0b7bf]"}>
                      {shopAddress || "주소 검색으로 매장 주소를 선택해 주세요"}
                    </span>
                  </div>
                  <span className="shrink-0 text-[15px] font-semibold text-[#111827]">주소 검색</span>
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
            aria-disabled={loading}
            className="flex h-[62px] w-full items-center justify-center rounded-[12px] bg-[#111827] px-5 text-[19px] font-semibold text-white transition hover:bg-[#1f2937] aria-disabled:cursor-wait aria-disabled:bg-[#111827] aria-disabled:text-white"
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
