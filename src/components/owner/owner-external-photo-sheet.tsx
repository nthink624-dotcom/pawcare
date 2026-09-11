"use client";

import { Camera, ChevronRight, ImagePlus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef } from "react";

type PhotoAction = {
  title: string;
  description: string;
  buttonLabel: string;
  skipLabel: string;
};

export default function OwnerExternalPhotoSheet({
  action,
  busy,
  canUseCameraApps,
  previewFile,
  allowSkip = true,
  onClose,
  onSkip,
  onSelectFile,
  onCapture,
  onClearPreview,
  onConfirm,
}: {
  action: PhotoAction;
  busy: boolean;
  canUseCameraApps: boolean;
  previewFile: File | null;
  allowSkip?: boolean;
  onClose: () => void;
  onSkip: () => void;
  onSelectFile: (file: File) => void;
  onCapture: (mode: "default" | "chooser") => void;
  onClearPreview: () => void;
  onConfirm: () => void;
}) {
  const libraryInputId = useId();
  const fallbackCameraInputId = useId();
  const previewUrlRef = useRef<string | null>(null);

  const setPreviewImage = useCallback((image: HTMLImageElement | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
    if (!image || !previewFile) return;
    const url = URL.createObjectURL(previewFile);
    previewUrlRef.current = url;
    image.src = url;
  }, [previewFile]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const chooseFile = (file: File | undefined) => {
    if (file) onSelectFile(file);
  };

  const isPreviewing = Boolean(previewFile);
  const confirmLabel = action.buttonLabel.replace("사진 찍고", "사진 등록하고");

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0d1726]/45 pt-12" onClick={onClose}>
      <section
        aria-label="사진 등록"
        className="w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#fbfcfe] shadow-[0_-18px_48px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d6deea]" />
        <header className="flex items-start justify-between px-5 pb-4 pt-4">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#4e82cf]">{isPreviewing ? "STEP 2 · 확인" : "STEP 1 · 사진 선택"}</p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#14213a]">
              {isPreviewing ? "이 사진으로 진행할까요?" : action.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#526276] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isPreviewing ? (
          <div className="px-5 pb-5">
            <div className="overflow-hidden rounded-[20px] border border-[#dce5f1] bg-white p-2 shadow-[0_8px_22px_rgba(49,75,112,0.08)]">
              <img ref={setPreviewImage} alt="등록할 사진 미리보기" className="h-[248px] w-full rounded-[14px] bg-[#f2f5f9] object-contain" />
            </div>
            <div className="mt-4 grid grid-cols-[0.9fr_1.4fr] gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onClearPreview}
                className="flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] border border-[#d7e0eb] bg-white text-[14px] font-semibold text-[#526276] disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> 다시 선택
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="h-[52px] rounded-[14px] bg-[#286bd1] px-3 text-[14px] font-semibold tracking-[-0.02em] text-white shadow-[0_7px_15px_rgba(40,107,209,0.25)] disabled:opacity-55"
              >
                {busy ? "사진 등록 중…" : confirmLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <input id={libraryInputId} type="file" accept="image/*" className="sr-only" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0])} />
            <input id={fallbackCameraInputId} type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0])} />

            {canUseCameraApps ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCapture("chooser")}
                className="group flex w-full items-center gap-3 rounded-[18px] border border-[#a9c8f4] bg-[#eaf3ff] px-4 py-4 text-left shadow-[0_8px_18px_rgba(62,125,210,0.12)] transition active:scale-[0.99] disabled:opacity-55"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#286bd1] text-white shadow-[0_5px_11px_rgba(40,107,209,0.24)]"><Camera className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1 text-[16px] font-semibold tracking-[-0.03em] text-[#1b457c]">카메라 앱 선택</span>
                <ChevronRight className="h-5 w-5 shrink-0 text-[#6b94c8] transition-transform group-active:translate-x-0.5" />
              </button>
            ) : (
              <label htmlFor={fallbackCameraInputId} className="flex w-full items-center gap-3 rounded-[18px] border border-[#a9c8f4] bg-[#eaf3ff] px-4 py-4 text-left shadow-[0_8px_18px_rgba(62,125,210,0.12)]">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#286bd1] text-white"><Camera className="h-5 w-5" /></span>
                <span className="text-[16px] font-semibold tracking-[-0.03em] text-[#1b457c]">기본 카메라로 촬영</span>
              </label>
            )}

            <div className="mt-2 grid grid-cols-2 gap-2">
              {canUseCameraApps && <button type="button" disabled={busy} onClick={() => onCapture("default")} className="flex min-h-[56px] items-center gap-2.5 rounded-[16px] border border-[#e0e6ef] bg-white px-3 text-left disabled:opacity-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#f0edfb] text-[#6751aa]"><Camera className="h-[18px] w-[18px]" /></span><span className="text-[14px] font-semibold text-[#3b3157]">기본 카메라</span></button>}
              <label htmlFor={libraryInputId} className={`flex min-h-[56px] items-center gap-2.5 rounded-[16px] border border-[#e0e6ef] bg-white px-3 text-left ${busy ? "pointer-events-none opacity-50" : "active:scale-[0.99]"}`}><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#edf1f5] text-[#526276]"><ImagePlus className="h-[18px] w-[18px]" /></span><span className="text-[14px] font-semibold text-[#2c3b50]">앨범에서 선택</span></label>
            </div>

            {allowSkip ? <button type="button" onClick={onSkip} disabled={busy} className="mt-3 h-10 w-full text-[13px] font-medium text-[#8a96a6] disabled:opacity-50">{action.skipLabel}</button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
