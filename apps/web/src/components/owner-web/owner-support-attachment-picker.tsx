"use client";

import { ImagePlus, X } from "lucide-react";

export type SelectedSupportAttachment = {
  id: string;
  file: File;
  previewUrl: string;
};

export default function OwnerSupportAttachmentPicker({
  attachments,
  error,
  submitting,
  onChange,
  onRemove,
}: {
  attachments: SelectedSupportAttachment[];
  error: string;
  submitting: boolean;
  onChange: (files: FileList | null) => void;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[14px] font-semibold text-[#334155]">문제 화면 첨부</span>
        <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-[9px] border border-[#dbe2ea] bg-white px-3 text-[13px] font-semibold text-[#334155] transition hover:bg-[#f8fafc]">
          <ImagePlus className="h-4 w-4" />
          스크린샷 추가
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            className="hidden"
            onChange={(event) => {
              onChange(event.target.files);
              event.target.value = "";
            }}
            disabled={attachments.length >= 3 || submitting}
          />
        </label>
      </div>
      {attachments.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((attachment) => (
            <div key={attachment.id} className="relative overflow-hidden rounded-[9px] border border-[#dbe2ea] bg-[#f8fafc]">
              <img src={attachment.previewUrl} alt={attachment.file.name} className="aspect-square w-full object-cover" />
              <button
                type="button"
                onClick={() => onRemove(attachment.id)}
                className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/95 text-[#334155] shadow-[0_4px_12px_rgba(15,23,42,0.16)]"
                title="첨부 제거"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
      <p className="text-[12px] font-medium text-[#64748b]">오류 화면이나 결제 내역 등 jpg, png, webp 이미지를 최대 3장까지 첨부할 수 있습니다.</p>
      {error ? <p className="text-[13px] font-semibold text-[#b42318]">{error}</p> : null}
    </div>
  );
}
