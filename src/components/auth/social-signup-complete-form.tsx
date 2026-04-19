"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, Search } from "lucide-react";

import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
  type SocialProvider,
} from "@/lib/auth/social-auth";
import {
  BUTTON_PRIMARY,
  BUTTON_SECONDARY,
  INLINE_ERROR,
  INLINE_HELP,
  INPUT_BASE,
  PAGE_DESCRIPTION,
  PAGE_EYEBROW,
  PAGE_FRAME,
  PAGE_TITLE,
  cn,
} from "@/lib/ui-system";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type AddressCandidate = {
  id: string;
  roadAddress: string;
  jibunAddress: string;
  postalCode: string;
};

const ADDRESS_CANDIDATES: AddressCandidate[] = [
  {
    id: "1",
    roadAddress: "서울 강남구 테헤란로 123",
    jibunAddress: "서울 강남구 삼성동 123-4",
    postalCode: "06134",
  },
  {
    id: "2",
    roadAddress: "서울 송파구 올림픽로 300",
    jibunAddress: "서울 송파구 신천동 29",
    postalCode: "05551",
  },
  {
    id: "3",
    roadAddress: "경기 성남시 분당구 판교역로 235",
    jibunAddress: "경기 성남시 삼평동 681",
    postalCode: "13494",
  },
  {
    id: "4",
    roadAddress: "부산 해운대구 센텀남대로 35",
    jibunAddress: "부산 해운대구 우동 1505",
    postalCode: "48058",
  },
];

const AGREEMENTS = {
  service: true,
  privacy: true,
  location: false,
  marketing: false,
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
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#6d675f]">{label}</span>
        {hint ? <span className="text-[12px] text-[#8b847b]">{hint}</span> : null}
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
  readOnly = false,
  onClick,
}: {
  value: string;
  onChange?: (value: string) => void;
  placeholder: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  readOnly?: boolean;
  onClick?: () => void;
}) {
  return (
    <input
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      placeholder={placeholder}
      inputMode={inputMode}
      readOnly={readOnly}
      onClick={onClick}
      className={INPUT_BASE}
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
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);

  const [, setResolvedProvider] = useState<SocialProvider | undefined>(provider);
  const [ownerName, setOwnerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [shopName, setShopName] = useState("");
  const [shopAddress, setShopAddress] = useState("");
  const [addressQuery, setAddressQuery] = useState("");
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

      if (!user) return;

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
  }, [supabase]);

  const filteredAddresses = useMemo(() => {
    const query = addressQuery.trim();
    if (!query) return ADDRESS_CANDIDATES;

    return ADDRESS_CANDIDATES.filter((item) =>
      [item.roadAddress, item.jibunAddress, item.postalCode].some((value) =>
        value.toLowerCase().includes(query.toLowerCase()),
      ),
    );
  }, [addressQuery]);

  const isFormValid =
    ownerName.trim().length > 0 &&
    /^01\d{8,9}$/.test(phoneNumber) &&
    shopName.trim().length > 0 &&
    shopAddress.trim().length > 0;

  const handleSelectAddress = (value: string) => {
    setShopAddress(value);
    setAddressSheetOpen(false);
    setAddressQuery("");
  };

  const handleSubmit = async () => {
    if (loading) return;

    if (!ownerName.trim()) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!/^01\d{8,9}$/.test(phoneNumber)) {
      setMessage("휴대폰번호를 확인해 주세요.");
      return;
    }

    if (!shopName.trim()) {
      setMessage("매장명을 입력해 주세요.");
      return;
    }

    if (!shopAddress.trim()) {
      setMessage("매장 주소를 입력해 주세요.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch("/api/auth/social-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ownerName: ownerName.trim(),
          phoneNumber,
          shopName: shopName.trim(),
          shopAddress: shopAddress.trim(),
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
      router.replace(nextPath as never);
      router.refresh();
    } catch {
      setMessage("기본 정보를 저장하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={cn(PAGE_FRAME, "bg-white text-[#111111]")}>
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <p className={PAGE_EYEBROW}>프로필 등록하기</p>
            <div>
              <h1 className={PAGE_TITLE}>기본 정보를 입력해 주세요</h1>
              <p className={cn(PAGE_DESCRIPTION, "mt-3")}>가입을 마무리하려면 아래 정보만 확인하면 돼요.</p>
            </div>
          </div>

          <Link
            href="/login"
            replace
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e3ded3] text-[#3b3834] transition hover:bg-[#faf7f2]"
            aria-label="로그인으로 돌아가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </div>

        <div className="mt-10 space-y-7">
          <div className="space-y-4">
            <FormField label="이름">
              <TextInput value={ownerName} onChange={setOwnerName} placeholder="대표자 또는 운영자 이름" />
            </FormField>

            <FormField label="휴대폰번호" hint="숫자만 입력해도 돼요">
              <TextInput
                value={formatPhone(phoneNumber)}
                onChange={(value) => setPhoneNumber(normalizePhone(value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
              />
            </FormField>

            <FormField label="매장명">
              <TextInput value={shopName} onChange={setShopName} placeholder="예: 포근한 발바닥 미용실" />
            </FormField>

            <FormField label="매장 주소" hint="검색 후 상세 주소를 이어서 적어도 돼요">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(true)}
                  className="flex h-[48px] w-full items-center gap-2 rounded-[14px] border border-[#cfd4cd] bg-white px-4 text-left text-[15px] font-medium tracking-[-0.02em] text-[#111827] transition hover:border-[#1f6b5b]"
                >
                  <Search className="h-4 w-4 text-[#1f6b5b]" />
                  <span className={shopAddress ? "text-[#111827]" : "text-[#b0b7bf]"}>
                    {shopAddress || "주소를 검색하거나 선택해 주세요"}
                  </span>
                </button>

                <TextInput value={shopAddress} onChange={setShopAddress} placeholder="상세 주소를 직접 입력해도 괜찮아요" />
                <p className={INLINE_HELP}>건물명이나 층수처럼 상세 정보가 있으면 이어서 입력해 주세요.</p>
              </div>
            </FormField>
          </div>

          {message ? <p className={INLINE_ERROR}>{message}</p> : null}

          <button type="button" onClick={handleSubmit} disabled={loading || !isFormValid} className={BUTTON_PRIMARY}>
            <span>{loading ? "저장 중.." : "무료체험 시작하기"}</span>
            {!loading ? <ChevronRight className="ml-1 h-4 w-4" /> : null}
          </button>
        </div>
      </div>

      {addressSheetOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35" onClick={() => setAddressSheetOpen(false)}>
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div
              className="w-full rounded-t-[26px] bg-white px-5 pb-5 pt-4 shadow-[0_-18px_50px_rgba(15,23,42,0.12)]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7dbd4]" />

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <p className={PAGE_EYEBROW}>주소 검색</p>
                  <h2 className="mt-2 text-[22px] font-extrabold tracking-[-0.05em] text-[#111827]">매장 주소를 선택해 주세요</h2>
                  <p className={cn(PAGE_DESCRIPTION, "mt-2")}>도로명, 지번, 우편번호로 검색해서 가장 가까운 주소를 선택할 수 있어요.</p>
                </div>
                <button type="button" onClick={() => setAddressSheetOpen(false)} className={cn(BUTTON_SECONDARY, "h-10 w-auto px-4")}>
                  닫기
                </button>
              </div>

              <div className="mt-4">
                <TextInput value={addressQuery} onChange={setAddressQuery} placeholder="예: 강남구 테헤란로" />
              </div>

              <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {filteredAddresses.length ? (
                  filteredAddresses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectAddress(item.roadAddress)}
                      className="w-full rounded-[14px] border border-[#ebe5dc] bg-[#faf9f6] px-4 py-3 text-left transition hover:border-[#1f6b5b] hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#e9f4ef] px-2 py-1 text-[11px] font-semibold text-[#1f6b5b]">도로명</span>
                        <span className="text-[11px] font-medium text-[#8a8f98]">{item.postalCode}</span>
                      </div>
                      <p className="mt-1.5 text-[14px] font-semibold tracking-[-0.02em] text-[#111827]">{item.roadAddress}</p>
                      <p className="mt-1 text-[12px] leading-5 text-[#7b828c]">{item.jibunAddress}</p>
                    </button>
                  ))
                ) : (
                  <div className="rounded-[16px] border border-dashed border-[#d9ddd8] bg-[#fafaf8] px-4 py-4">
                    <p className="text-[14px] font-medium text-[#667085]">검색 결과가 없어요.</p>
                    <p className="mt-1 text-[12px] leading-5 text-[#8a8f98]">
                      검색어를 바꾸거나 현재 입력한 주소를 그대로 사용할 수 있어요.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelectAddress(addressQuery.trim())}
                      disabled={!addressQuery.trim()}
                      className={cn(BUTTON_PRIMARY, "mt-4 h-10")}
                    >
                      현재 입력한 주소 사용
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
