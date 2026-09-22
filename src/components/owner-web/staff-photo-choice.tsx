"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { StableAvatar } from "@/components/owner-web/stable-avatar";
import type { StaffDraft } from "@/components/owner-web/staff-management-model";
import { STAFF_PROFILE_ACCEPTED_IMAGE_TYPES, STAFF_PROFILE_MAX_SOURCE_FILE_BYTES } from "@/components/owner-web/staff-profile-photo-field";
import { staffProfileFallbackKeys, resolveStaffProfileFallbackImageUrl } from "@/lib/staff-profile-fallback";

type PhotoPatch = Pick<StaffDraft, "profileImageUrl" | "profileImageFallbackKey" | "profileImageChoice" | "profileImageFile" | "profileImagePendingUpload">;

function PhotoRegistrationCard({ compact = false, onChange }: { compact?: boolean; onChange: (patch: PhotoPatch) => void }) {
  const [error, setError] = useState("");
  return (
    <div>
      <label className={compact
        ? "inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-[8px] border border-[#dbe2ea] bg-white px-3 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#94a3b8]"
        : "flex min-h-11 cursor-pointer flex-col items-center justify-center gap-2 rounded-[10px] border border-[#dbe2ea] bg-white px-2 py-3 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc] focus-within:ring-2 focus-within:ring-[#94a3b8]"}>
        {compact ? <ImagePlus className="h-4 w-4" aria-hidden="true" /> : <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[#f1f5f9] text-[#475569]"><ImagePlus className="h-7 w-7" aria-hidden="true" /></span>}
        사진 등록
        <input type="file" accept={STAFF_PROFILE_ACCEPTED_IMAGE_TYPES.join(",")} className="sr-only" aria-label="프로필 사진 올리기" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (!STAFF_PROFILE_ACCEPTED_IMAGE_TYPES.includes(file.type as (typeof STAFF_PROFILE_ACCEPTED_IMAGE_TYPES)[number])) {
            setError("JPG, PNG, WEBP 형식의 사진을 선택해 주세요.");
            return;
          }
          if (file.size > STAFF_PROFILE_MAX_SOURCE_FILE_BYTES) {
            setError("사진은 20MB 이하로 선택해 주세요.");
            return;
          }
          setError("");
          onChange({ profileImageUrl: "", profileImageFallbackKey: null, profileImageChoice: "photo", profileImageFile: file, profileImagePendingUpload: null });
        }} />
      </label>
      {error ? <p role="alert" className="mt-2 text-[13px] text-[#a04455]">{error}</p> : null}
    </div>
  );
}

export function StaffProfileImagePicker({ value, onChange, onClose }: {
  value: StaffDraft["profileImageFallbackKey"];
  onChange: (patch: PhotoPatch) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  function choose(patch: PhotoPatch) {
    onChange(patch);
    onClose();
  }
  return (
    <dialog ref={dialogRef} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[calc(100dvh-32px)] w-[calc(100%-32px)] max-w-[400px] overflow-y-auto rounded-[12px] border border-[#dbe2ea] bg-white p-5 text-[#111827] shadow-xl backdrop:bg-slate-900/30">
      <div className="flex items-center justify-between gap-3">
        <h3 id={titleId} className="text-[20px] font-semibold">프로필 이미지 선택</h3>
        <button type="button" onClick={onClose} aria-label="이미지 선택 닫기" className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-[#f8fafc]"><X className="h-5 w-5" /></button>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-2">
        <PhotoRegistrationCard onChange={choose} />
        {staffProfileFallbackKeys.map((key, index) => (
          <button key={key} type="button" aria-pressed={value === key} onClick={() => choose({ profileImageUrl: "", profileImageFallbackKey: key, profileImageChoice: "default", profileImageFile: null, profileImagePendingUpload: null })} className="flex min-h-11 flex-col items-center gap-2 rounded-[10px] border border-[#dbe2ea] p-2 text-[14px] font-medium hover:bg-[#f8fafc] aria-pressed:border-[#64748b]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={resolveStaffProfileFallbackImageUrl(key)} alt="" className="h-20 w-20 rounded-full object-cover" />
            {index === 0 ? "여자 기본 이미지" : "남자 기본 이미지"}
          </button>
        ))}
      </div>
    </dialog>
  );
}

export function StaffPhotoField({ identity, name, value, imageAssetId, title = "프로필", subtitle = "", photoFile, fallbackKey, onChange }: {
  identity: string; name: string; value: string; imageAssetId?: string | null; title?: string; subtitle?: string;
  photoFile?: File | null; fallbackKey?: StaffDraft["profileImageFallbackKey"];
  onChange: (patch: PhotoPatch) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const previewRef = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!photoFile) return;
    const url = URL.createObjectURL(photoFile);
    if (previewRef.current) previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);
  return (
    <div className="flex flex-col items-center gap-2">
      {photoFile ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={previewRef} alt={`${name || "직원"} 프로필 미리보기`} className="h-16 w-16 rounded-full border border-[#e8edf3] object-cover" />
      ) : <StableAvatar identity={identity} name={name} imageUrl={value} imageAssetId={imageAssetId} profileImageFallbackKey={fallbackKey} size="lg" />}
      <div className="max-w-full text-center"><p className="truncate text-[16px] font-medium">{title}</p>{subtitle ? <p className="text-[13px] text-[#64748b]">{subtitle}</p> : null}</div>
      <div className="flex flex-wrap justify-center gap-2">
        <PhotoRegistrationCard compact onChange={onChange} />
        <button type="button" onClick={() => setPickerOpen(true)} className="min-h-11 rounded-[8px] border border-[#dbe2ea] px-3 text-[14px] font-medium text-[#334155] hover:bg-[#f8fafc]">기본 이미지 선택</button>
      </div>
      {pickerOpen ? <StaffProfileImagePicker value={fallbackKey} onChange={onChange} onClose={() => setPickerOpen(false)} /> : null}
    </div>
  );
}
