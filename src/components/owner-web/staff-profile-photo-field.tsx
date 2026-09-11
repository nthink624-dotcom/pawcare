"use client";

import { ImagePlus, RotateCcw, Trash2 } from "lucide-react";
import { useEffect, useId, useState } from "react";

import { StableAvatar } from "@/components/owner-web/stable-avatar";

export const STAFF_PROFILE_ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const STAFF_PROFILE_MAX_SOURCE_FILE_BYTES = 20 * 1024 * 1024;

export type InitialSetupStaffPhotoDraft = {
  file: File | null;
  mode: "keep" | "replace" | "remove";
  pendingUpload?: StaffProfilePhotoUploadResult | null;
};

export type StaffProfilePhotoUploadResult = {
  mediaAssetId: string;
  signedUrl: string;
};

export type StaffProfilePhotoUploader = (
  context: { shopId: string; staffId: string },
  file: File,
) => Promise<StaffProfilePhotoUploadResult>;

export default function StaffProfilePhotoField({
  name,
  persistedUrl,
  photo,
  disabled = false,
  onFileChange,
  onRemove,
  onReset,
  onError,
}: {
  name: string;
  persistedUrl: string;
  photo: InitialSetupStaffPhotoDraft;
  disabled?: boolean;
  onFileChange: (file: File) => void;
  onRemove: () => void;
  onReset: () => void;
  onError: (message: string) => void;
}) {
  const inputId = useId();
  const [selectedPreviewUrl, setSelectedPreviewUrl] = useState("");

  useEffect(() => {
    let objectUrl = "";
    const frame = window.requestAnimationFrame(() => {
      if (!photo.file) {
        setSelectedPreviewUrl("");
        return;
      }
      objectUrl = URL.createObjectURL(photo.file);
      setSelectedPreviewUrl(objectUrl);
    });
    return () => {
      window.cancelAnimationFrame(frame);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photo.file]);

  const previewUrl = selectedPreviewUrl || photo.pendingUpload?.signedUrl || (photo.mode === "remove" ? "" : persistedUrl);

  function acceptFile(file: File | undefined) {
    if (!file) return;
    if (!STAFF_PROFILE_ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof STAFF_PROFILE_ACCEPTED_IMAGE_TYPES)[number])) {
      onError("JPG, PNG, WEBP 형식의 사진을 선택해 주세요.");
      return;
    }
    if (file.size > STAFF_PROFILE_MAX_SOURCE_FILE_BYTES) {
      onError("사진은 20MB 이하로 선택해 주세요.");
      return;
    }
    onError("");
    onFileChange(file);
  }

  return (
    <div className="min-w-0" data-testid="initial-setup-staff-photo-field">
      <div className="flex min-w-0 flex-wrap items-center gap-3">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#dbe2ea] bg-[#f8fafc] text-[24px] font-medium text-[#475569]">
          {previewUrl ? (
            <img src={previewUrl} alt={`${name || "직원"} 프로필 미리보기`} className="h-full w-full object-cover" />
          ) : (
            <StableAvatar identity={`${name || "staff"}-initial-setup`} name={name} size="lg" className="h-full w-full border-0" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium leading-5 text-[#15213b]">프로필 사진 (선택)</p>
          <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#64748b]">JPG · PNG · WEBP, 최대 20MB</p>
          {photo.pendingUpload ? <p className="mt-0.5 text-[13px] font-normal leading-5 text-[#64748b]">업로드한 사진을 저장 대기 중입니다. 다시 저장해도 재업로드하지 않습니다.</p> : null}
          <div className="mt-2 flex min-w-0 flex-wrap gap-2">
            <label
              htmlFor={inputId}
              className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium leading-5 text-[#334155] hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#2563eb]"
            >
              <ImagePlus className="h-4 w-4" aria-hidden="true" />
              프로필 사진 올리기
              <input
                id={inputId}
                type="file"
                accept={STAFF_PROFILE_ACCEPTED_IMAGE_TYPES.join(",")}
                className="sr-only"
                disabled={disabled}
                onChange={(event) => {
                  acceptFile(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            {photo.mode !== "keep" ? (
              <button
                type="button"
                onClick={onReset}
                disabled={disabled}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium leading-5 text-[#475569] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                초기화
              </button>
            ) : null}
            {previewUrl ? (
              <button
                type="button"
                onClick={onRemove}
                disabled={disabled}
                className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[10px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium leading-5 text-[#a04455] hover:bg-[#fff7f8] disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                사진 삭제
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
