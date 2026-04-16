"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ChevronRight, MapPin, Search } from "lucide-react";

import { OWNER_SIGNUP_TERMS_VERSION } from "@/lib/auth/owner-signup-terms";
import {
  PENDING_SOCIAL_PROVIDER_STORAGE,
  resolveSocialProviderFromAuthUser,
  type SocialProvider,
} from "@/lib/auth/social-auth";
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
    jibunAddress: "서울 강남구 역삼동 123-4",
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
  {
    id: "5",
    roadAddress: "대전 유성구 대학로 99",
    jibunAddress: "대전 유성구 궁동 123",
    postalCode: "34184",
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

function getProviderLabel(provider: SocialProvider | null | undefined) {
  if (provider === "kakao") return "카카오";
  if (provider === "naver") return "네이버";
  if (provider === "google") return "구글";
  return "소셜";
}

function Field({
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
        <span className="text-[12px] font-medium tracking-[-0.01em] text-[#6b7280]">{label}</span>
        {hint ? <span className="text-[12px] text-[#8a8f98]">{hint}</span> : null}
      </div>
      {children}
    </label>
  );
}

function Input({
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
      className="h-[48px] w-full rounded-[14px] border border-[#cfd4cd] bg-white px-4 text-[15px] font-medium tracking-[-0.02em] text-[#111827] outline-none transition placeholder:text-[#b0b7bf] focus:border-[#2f786b] focus:ring-3 focus:ring-[#2f786b]/10"
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

  const [resolvedProvider, setResolvedProvider] = useState<SocialProvider | undefined>(provider);
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
          normalizePhone(
            readMetadataValue(user.user_metadata, ["phone", "phone_number", "phoneNumber"]) || user.phone || "",
          ),
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
      setMessage("이름을 입력해주세요.");
      return;
    }

    if (!/^01\d{8,9}$/.test(phoneNumber)) {
      setMessage("휴대폰번호를 정확히 입력해주세요.");
      return;
    }

    if (!shopName.trim()) {
      setMessage("매장명을 입력해주세요.");
      return;
    }

    if (!shopAddress.trim()) {
      setMessage("매장 주소를 입력해주세요.");
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
        setMessage(result.message ?? "가입 정보를 저장하지 못했어요. 다시 시도해주세요.");
        return;
      }

      await supabase?.auth.refreshSession();
      router.replace(nextPath as never);
      router.refresh();
    } catch {
      setMessage("가입 정보를 저장하지 못했어요. 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[#f6f5f1] px-5 pb-8 pt-5 text-[#111827]">
        <div className="flex items-center justify-between">
          <Link
            href="/login"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-[#e3e6df] bg-white text-[#1f2937] shadow-[0_8px_24px_rgba(15,23,42,0.05)]"
            aria-label="뒤로가기"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <span className="text-[13px] font-semibold tracking-[0.08em] text-[#8b9188]">회원가입 마지막 단계</span>
        </div>

        <div className="mt-7 rounded-[22px] bg-white px-5 pb-5 pt-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)]">
          <div className="text-center">
            <p className="text-[14px] font-semibold tracking-[0.02em] text-[#5f665f]">프로필 등록하기</p>
            <h1 className="mt-3 text-[24px] font-extrabold tracking-[-0.05em] text-[#101828]">기본 정보를 입력해 주세요</h1>
          </div>

          <div className="mt-8 space-y-3.5">
            <Field label="이름">
              <Input value={ownerName} onChange={setOwnerName} placeholder="대표자 또는 담당자 이름" />
            </Field>

            <Field label="휴대폰번호" hint="숫자만 입력">
              <Input
                value={formatPhone(phoneNumber)}
                onChange={(value) => setPhoneNumber(normalizePhone(value))}
                placeholder="010-0000-0000"
                inputMode="numeric"
              />
            </Field>

            <Field label="매장명">
              <Input value={shopName} onChange={setShopName} placeholder="예: 포근한 발바닥 미용실" />
            </Field>

            <Field label="매장 주소" hint="검색 또는 직접 입력">
              <div className="space-y-2.5">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setAddressSheetOpen(true)}
                    className="flex h-[48px] flex-1 items-center gap-2 rounded-[14px] border border-[#cfd4cd] bg-white px-4 text-left text-[15px] font-medium tracking-[-0.02em] text-[#111827] shadow-none transition hover:border-[#2f786b]"
                  >
                    <Search className="h-4 w-4 text-[#2f786b]" />
                    <span className={shopAddress ? "text-[#111827]" : "text-[#b0b7bf]"}>
                      {shopAddress || "주소를 검색하거나 선택해주세요"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddressSheetOpen(true)}
                    className="h-[48px] rounded-[14px] bg-[#eef7f3] px-4 text-[13px] font-semibold text-[#2f786b]"
                  >
                    주소 검색
                  </button>
                </div>

                <Input value={shopAddress} onChange={setShopAddress} placeholder="상세 주소까지 직접 입력해도 됩니다" />
                <p className="px-1 text-[11px] leading-5 text-[#8a8f98]">
                  검색으로 선택한 뒤 건물명, 층수 같은 상세 주소를 이어서 적어도 괜찮아요.
                </p>
              </div>
            </Field>
          </div>

          {message ? <p className="mt-4 text-[13px] leading-6 text-[#d14343]">{message}</p> : null}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || !isFormValid}
            className="mt-6 flex h-[48px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2f786b] text-[15px] font-semibold text-white transition hover:bg-[#28695d] disabled:cursor-not-allowed disabled:bg-[#d8ddd9] disabled:text-white"
          >
            <span>{loading ? "가입 마무리 중..." : "무료체험 시작하기"}</span>
            {!loading ? <ChevronRight className="h-4 w-4" /> : null}
          </button>
        </div>
      </div>

      {addressSheetOpen ? (
        <div className="fixed inset-0 z-50 bg-black/35">
          <div className="mx-auto flex min-h-screen w-full max-w-[430px] items-end">
            <div className="w-full rounded-t-[26px] bg-white px-5 pb-5 pt-4 shadow-[0_-18px_50px_rgba(15,23,42,0.12)]">
              <div className="mx-auto h-1.5 w-12 rounded-full bg-[#d7dbd4]" />

              <div className="mt-5 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-[18px] font-bold tracking-[-0.04em] text-[#111827]">매장 주소 검색</h2>
                  <p className="mt-1 text-[12px] leading-6 text-[#7b828c]">도로명 또는 지번으로 검색한 뒤 가장 가까운 주소를 선택해주세요.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAddressSheetOpen(false)}
                  className="rounded-full border border-[#e5e7eb] px-3 py-1.5 text-[13px] font-medium text-[#667085]"
                >
                  닫기
                </button>
              </div>

              <div className="mt-4">
                <Input value={addressQuery} onChange={setAddressQuery} placeholder="예: 강남구 테헤란로" />
              </div>

              <div className="mt-4 max-h-[45vh] space-y-2 overflow-y-auto pr-1">
                {filteredAddresses.length ? (
                  filteredAddresses.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelectAddress(item.roadAddress)}
                      className="w-full rounded-[14px] border border-[#e3e6df] bg-[#fafaf8] px-4 py-2 text-left transition hover:border-[#2f786b] hover:bg-white"
                    >
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-[#e7f6ef] px-2 py-1 text-[11px] font-semibold text-[#2f786b]">도로명</span>
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
                      입력한 주소를 그대로 사용하려면 아래 버튼을 눌러주세요.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSelectAddress(addressQuery.trim())}
                      disabled={!addressQuery.trim()}
                      className="mt-4 h-10 rounded-[13px] bg-[#2f786b] px-4 text-[14px] font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#d8ddd9]"
                    >
                      현재 입력한 주소로 사용
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
