"use client";

import { useEffect, useMemo, useState } from "react";

import { WebSurface } from "@/components/owner-web/owner-web-ui";
import { fetchApiJsonWithAuth } from "@/lib/api";
import type { OwnerProfile, Shop } from "@/types/domain";

type OwnerProfileSettingsPanelProps = {
  shop?: Shop;
  ownerProfile?: OwnerProfile | null;
  persistToSupabase?: boolean;
  onOwnerProfileChange?: (profile: OwnerProfile) => void;
};

function normalizePhone(value: string) {
  return value.replace(/[^\d+-]/g, "").slice(0, 30);
}

function getProfileImageUrl(profile: OwnerProfile | null | undefined) {
  const imageUrl = profile?.agreements?.profile_image_url;
  return typeof imageUrl === "string" ? imageUrl : "";
}

function readImageFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error("사진을 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

function buildLocalProfile(
  shop: Shop | undefined,
  ownerProfile: OwnerProfile | null | undefined,
  name: string,
  phoneNumber: string,
  profileImageUrl: string,
): OwnerProfile {
  const now = new Date().toISOString();
  const userId = ownerProfile?.user_id ?? shop?.owner_user_id ?? "demo-owner";

  return {
    user_id: userId,
    shop_id: ownerProfile?.shop_id ?? shop?.id ?? "demo-shop",
    login_id: ownerProfile?.login_id ?? `owner_${userId.replace(/-/g, "")}`,
    name,
    birth_date: ownerProfile?.birth_date ?? null,
    phone_number: phoneNumber,
    identity_verified_at: ownerProfile?.identity_verified_at ?? null,
    agreements: {
      ...(ownerProfile?.agreements ?? {}),
      profile_image_url: profileImageUrl,
    },
    created_at: ownerProfile?.created_at ?? now,
    updated_at: now,
  };
}

export default function OwnerProfileSettingsPanel({
  shop,
  ownerProfile,
  persistToSupabase = true,
  onOwnerProfileChange,
}: OwnerProfileSettingsPanelProps) {
  const initialName = useMemo(() => ownerProfile?.name?.trim() || "오너", [ownerProfile?.name]);
  const initialPhone = useMemo(() => ownerProfile?.phone_number?.trim() || shop?.phone?.trim() || "", [ownerProfile?.phone_number, shop?.phone]);
  const initialProfileImageUrl = useMemo(() => getProfileImageUrl(ownerProfile), [ownerProfile]);
  const loginId = ownerProfile?.login_id?.trim() || "-";
  const [name, setName] = useState(initialName);
  const [phoneNumber, setPhoneNumber] = useState(initialPhone);
  const [profileImageUrl, setProfileImageUrl] = useState(initialProfileImageUrl);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setName(initialName);
    setPhoneNumber(initialPhone);
    setProfileImageUrl(initialProfileImageUrl);
  }, [initialName, initialPhone, initialProfileImageUrl]);

  async function changeProfileImage(file: File | null | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setNotice("이미지 파일만 등록할 수 있습니다.");
      return;
    }

    try {
      const dataUrl = await readImageFileAsDataUrl(file);
      setProfileImageUrl(dataUrl);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "사진을 읽지 못했습니다.");
    }
  }

  async function saveProfile() {
    const nextName = name.trim();
    const nextPhoneNumber = normalizePhone(phoneNumber);
    if (!shop?.id || !nextName || saving) return;

    setSaving(true);
    setNotice("");

    try {
      if (!persistToSupabase) {
        const profile = buildLocalProfile(shop, ownerProfile, nextName, nextPhoneNumber, profileImageUrl);
        onOwnerProfileChange?.(profile);
        setNotice("저장되었습니다.");
        return;
      }

      const result = await fetchApiJsonWithAuth<{ profile: OwnerProfile }>("/api/owner/profile", {
        method: "PATCH",
        body: JSON.stringify({
          shopId: shop.id,
          name: nextName,
          phoneNumber: nextPhoneNumber,
          profileImageUrl,
        }),
      });
      onOwnerProfileChange?.(result.profile);
      setNotice("저장되었습니다.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "저장하지 못했습니다.");
    } finally {
      setSaving(false);
      window.setTimeout(() => setNotice(""), 1800);
    }
  }

  return (
    <WebSurface className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-semibold text-[#0f172a]">프로필</h2>
          <p className="mt-1 text-[15px] leading-6 text-[#64748b]">
            로그인 계정 정보를 관리합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={saveProfile}
          disabled={saving || !name.trim()}
          className="inline-flex h-11 min-w-[92px] items-center justify-center rounded-[8px] bg-[#2f7866] px-5 text-[16px] font-medium text-white transition hover:bg-[#286b5b] disabled:cursor-not-allowed disabled:bg-[#cbd5e1]"
        >
          {saving ? "저장 중" : "저장"}
        </button>
      </div>

      <div className="mt-7 flex flex-wrap items-start gap-6">
        <div className="grid gap-3">
          <div className="flex h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-[12px] border border-[#dbe2ea] bg-[#f8fafc]">
            {profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profileImageUrl} alt="프로필 사진" className="h-full w-full object-cover" />
            ) : (
              <span className="text-[32px] font-semibold text-[#2f7866]">{name.trim().slice(0, 1) || "P"}</span>
            )}
          </div>
          <label className="inline-flex h-10 cursor-pointer items-center justify-center rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[15px] font-normal text-[#334155] transition hover:bg-[#f8fafc]">
            사진 변경
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                void changeProfileImage(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
        </div>

        <div className="grid min-w-[280px] flex-1 gap-5">
          <label className="grid gap-2 text-[16px] text-[#0f172a]">
            <span className="font-medium">아이디</span>
            <input
              value={loginId}
              readOnly
              className="h-12 rounded-[8px] border border-[#dbe2ea] bg-[#f8fafc] px-4 text-[16px] font-normal text-[#64748b] outline-none"
            />
          </label>

        <label className="grid gap-2 text-[16px] text-[#0f172a]">
          <span className="font-medium">이름</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="h-12 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-normal text-[#0f172a] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8]"
            placeholder="이름을 입력해 주세요."
          />
        </label>

        <label className="grid gap-2 text-[16px] text-[#0f172a]">
          <span className="font-medium">휴대전화번호</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(normalizePhone(event.target.value))}
            className="h-12 rounded-[8px] border border-[#dbe2ea] bg-white px-4 text-[16px] font-normal text-[#0f172a] outline-none transition focus:border-[#2f7866] focus:ring-2 focus:ring-[#dceee8]"
            placeholder="010-0000-0000"
            inputMode="tel"
          />
        </label>
        </div>
      </div>

      <div className="mt-7 rounded-[8px] border border-[#e2e8f0] bg-[#f8fafc] p-4">
        <p className="text-[16px] font-medium text-[#0f172a]">제공정보 활용처</p>
        <div className="mt-3 grid gap-2 text-[15px] leading-6 text-[#475569]">
          <p>회원이름은 오너 계정 이름과 프로필 식별에 사용됩니다.</p>
          <p>휴대전화번호는 오너 연락처 확인과 매장 운영 연락처 보조 정보로 사용됩니다.</p>
        </div>
      </div>

      {notice ? <p className="mt-4 text-[15px] text-[#2f7866]">{notice}</p> : null}
    </WebSurface>
  );
}
