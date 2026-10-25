"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Camera, Check, Plus, X } from "lucide-react";
import SetupModal from "@/components/ui/setup-modal";
import type { BootstrapStaffMember } from "@/types/domain";
import { createOwnerMediaAssetFromFile, getOwnerMediaSignedUrl } from "@/lib/media/owner-media-client";
import { staffProfileFallbackKeys, resolveStaffProfileFallbackImageUrl } from "@/lib/staff-profile-fallback";
import { canEditSetupStaffPhoto, replaceSetupStaffPhoto, removeSetupStaffPhoto } from "@/lib/initial-setup-staff-photo";
import { setupInput } from "./initial-setup-fields";
import styles from "./initial-setup-layout.module.css";
import SetupProfilePhotoSources from "./setup-profile-photo-sources";

const weekdays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const labels = ["월", "화", "수", "목", "금", "토", "일"];
const secondary = "min-h-11 rounded-[10px] border border-[#d9e1ec] px-3 text-[14px] font-medium disabled:opacity-50";

export default function SetupStaffFields({ staff, onChange, savedIds, shopId, onUploadingChange }: {
  staff: BootstrapStaffMember[]; onChange: (value: BootstrapStaffMember[]) => void;
  savedIds: string[]; shopId: string; onUploadingChange: (value: boolean) => void;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [photoMenu, setPhotoMenu] = useState<string | null>(null);
  const photoTrigger = useRef<HTMLButtonElement | null>(null);
  const captureLock = useRef(false);
  const [capturing, setCapturing] = useState(false);
  const closePhotoMenu = () => {
    if (captureLock.current) return;
    setPhotoMenu(null);
    requestAnimationFrame(() => photoTrigger.current?.focus());
  };
  const lock = useRef(false);
  const current = useRef(staff);
  current.current = staff;
  const update = (id: string, patch: Partial<BootstrapStaffMember>) => onChange(current.current.map((member) => member.id === id ? { ...member, ...patch } : member));

  async function upload(id: string, file?: File) {
    if (!file || lock.current) return;
    const initial = current.current.find((item) => item.id === id);
    if (!initial || !canEditSetupStaffPhoto(initial)) return;
    if (!file.type.startsWith("image/")) { setError("이미지 파일을 선택해 주세요."); return; }
    lock.current = true; setUploading(id); onUploadingChange(true); setError("");
    try {
      const uploaded = await createOwnerMediaAssetFromFile({ shopId, metadata: { staffId: id } }, "staff_profile", file, { createProviderReadyVariant: false });
      const url = await getOwnerMediaSignedUrl(shopId, uploaded.mediaAsset.id);
      const member = current.current.find((item) => item.id === id);
      if (member) update(id, replaceSetupStaffPhoto(member, uploaded.mediaAsset.id, url));
    } catch {
      setError("사진을 등록하지 못했어요. 기존 사진은 유지됩니다. 다시 시도해 주세요.");
    } finally {
      lock.current = false; setUploading(null); onUploadingChange(false);
    }
  }

  return <div className="space-y-4">
    <fieldset disabled={Boolean(uploading)} className="min-w-0 space-y-5">
      {staff.map((member) => {
        const photo = member.profileImageUrl || member.profileImageUrls?.[0];
        const hasPhoto = Boolean(photo || member.profileImageAssetIds?.length);
        const canEdit = canEditSetupStaffPhoto(member);
        const canUsePreset = canEdit && (member.profileImageAssetIds?.length ?? 0) <= 1 && (member.profileImageUrls?.length ?? 0) <= 1;
        return <fieldset key={member.id} className="min-w-0 space-y-4 border-b border-[#edf1f5] pb-5">
          {staff.length > 1 && <legend className="mb-3 text-[16px] font-medium">{member.name.trim() || "새 담당자"}</legend>}
          <div className="space-y-2">
            <div className="flex items-center justify-between"><p className="text-[14px] font-medium">프로필 사진</p>
            {!savedIds.includes(member.id) && <button type="button" aria-label={`${member.name || "새 담당자"} 추가 취소`} className="flex h-11 w-11 shrink-0 items-center justify-center" onClick={() => onChange(staff.filter((item) => item.id !== member.id))}><X size={18} /></button>}
            </div>
            <div className="flex items-start gap-4" role="group" aria-label={`${member.name || "담당자"} 프로필 선택`}>
              <div className="flex shrink-0 flex-col items-center gap-1.5">
              <button type="button" disabled={!canEdit} aria-label={hasPhoto ? "프로필 사진 변경" : "프로필 사진 등록"} aria-pressed={hasPhoto} aria-haspopup="dialog" className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 bg-[#f1f3f7] text-[#64748b] disabled:opacity-50 ${hasPhoto ? "border-[#111a30]" : "border-transparent"}`} onClick={(event) => { photoTrigger.current = event.currentTarget; setPhotoMenu(member.id); }}>
                {photo ?
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo} alt="등록한 프로필" className="h-full w-full rounded-full object-cover" /> : <Camera size={26} aria-hidden />}
                {hasPhoto && <SelectionMark />}
              </button>
              <span className="text-[13px] leading-5 text-[#64748b]">사진 등록</span>
              </div>
              {staffProfileFallbackKeys.map((key, index) => {
                const selected = !hasPhoto && member.profileImageFallbackKey === key;
                return <button key={key} type="button" disabled={!canUsePreset} aria-label={`기본 이미지 ${index + 1}`} aria-pressed={selected} className={`relative h-16 w-16 shrink-0 rounded-full border-2 disabled:opacity-50 ${selected ? "border-[#111a30]" : "border-transparent"}`} onClick={() => update(member.id, { profileImageFallbackKey: key, profileImageUrl: "", profileImageUrls: [], profileImageAssetIds: [] })}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={resolveStaffProfileFallbackImageUrl(key)} alt="" className="h-full w-full rounded-full object-cover" />
                  {selected && <SelectionMark />}
                </button>;
              })}
            </div>
          </div>
          {uploading === member.id && <p role="status" className="text-[13px] text-[#64748b]">사진 등록 중…</p>}
          {!canEdit && <p role="status" className="text-[13px] leading-5 text-[#64748b]">기존 사진 연결을 확인할 수 없어 여기서는 사진을 변경할 수 없어요.</p>}
          {canEdit && !canUsePreset && <p className="text-[13px] leading-5 text-[#64748b]">등록된 사진이 여러 장이면 기본 이미지로 변경할 수 없어요.</p>}
          <label className="block space-y-2 text-[14px] font-medium">이름<input className={setupInput} value={member.name} onChange={(event) => update(member.id, { name: event.target.value })} /></label>
          <div className="space-y-2" role="group" aria-label={`${member.name || "담당자"} 근무일`}>
            <p className="text-[14px] font-medium">근무일</p>
            <div className="grid grid-cols-7 gap-px">{weekdays.map((day, index) => {
              const selected = member.defaultDays?.includes(day) ?? false;
              return <button key={day} type="button" aria-label={`${labels[index]}요일`} aria-pressed={selected} className={`min-h-11 min-w-0 rounded-[8px] border text-[16px] font-medium ${selected ? "border-[#111a30] bg-[#111a30] text-white" : "border-[#d9e1ec] bg-white text-[#64748b]"}`} onClick={() => update(member.id, { defaultDays: selected ? (member.defaultDays ?? []).filter((value) => value !== day) : [...(member.defaultDays ?? []), day] })}>{labels[index]}</button>;
            })}</div>
          </div>
          <div className={`${styles.hours} grid grid-cols-2 gap-3`}>
            <label className="min-w-0 space-y-2 text-[14px] font-medium">근무 시작<input className={setupInput} type="time" value={member.startTime ?? ""} onChange={(event) => update(member.id, { startTime: event.target.value })} /></label>
            <label className="min-w-0 space-y-2 text-[14px] font-medium">근무 종료<input className={setupInput} type="time" value={member.endTime ?? ""} onChange={(event) => update(member.id, { endTime: event.target.value })} /></label>
          </div>
        </fieldset>;
      })}
      <button type="button" className={`${secondary} flex w-full items-center justify-center gap-2`} onClick={() => onChange([...staff, { id: crypto.randomUUID(), name: "", startTime: "", endTime: "", defaultDays: [], profileImageFallbackKey: null }])}><Plus size={18} aria-hidden />담당자 추가</button>
    </fieldset>
    {error && <p role="alert" className="text-[13px] leading-5 text-red-600">{error}</p>}
    {photoMenu && createPortal(<SetupModal label="프로필 사진 등록" onCancel={closePhotoMenu}>
      <section className="space-y-4 p-5">
        <header className="flex items-center justify-between"><h2 className="text-[20px] font-semibold leading-7">프로필 사진 등록</h2><button type="button" disabled={capturing} aria-label="사진 선택 닫기" className="flex h-11 w-11 items-center justify-center disabled:opacity-50" onClick={closePhotoMenu}><X size={20} /></button></header>
        <SetupProfilePhotoSources onBusyChange={(value) => { captureLock.current = value; setCapturing(value); onUploadingChange(value); }} onFile={(file) => { const id = photoMenu; closePhotoMenu(); void upload(id, file); }} />
        {staff.some((member) => member.id === photoMenu && (member.profileImageUrl || member.profileImageAssetIds?.length || member.profileImageUrls?.length)) && <button type="button" disabled={capturing} className="min-h-11 w-full text-[14px] text-[#64748b] underline disabled:opacity-50" onClick={() => { const member = current.current.find((item) => item.id === photoMenu); if (member && canEditSetupStaffPhoto(member)) update(member.id, removeSetupStaffPhoto(member)); closePhotoMenu(); }}>현재 사진 삭제</button>}
      </section>
    </SetupModal>, document.body)}
  </div>;
}

function SelectionMark() {
  return <span className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-[#111a30] text-white"><Check size={13} strokeWidth={3} aria-hidden /></span>;
}
