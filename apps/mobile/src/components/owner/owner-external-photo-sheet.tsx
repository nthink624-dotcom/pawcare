"use client";

import { Camera, ImagePlus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import type { ExternalCameraAppsAvailability } from "@/lib/media/external-camera";

type PhotoAction = {
  title: string;
  description: string;
  buttonLabel: string;
  skipLabel: string;
};

export default function OwnerExternalPhotoSheet({
  action,
  busy,
  cameraAppsAvailability,
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
  cameraAppsAvailability: ExternalCameraAppsAvailability;
  previewFile: File | null;
  allowSkip?: boolean;
  onClose: () => void;
  onSkip: () => void;
  onSelectFile: (file: File) => void;
  onCapture: (mode: "default" | "chooser") => void;
  onClearPreview: () => void;
  onConfirm: () => void;
}) {
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [cameraAppsNotice, setCameraAppsNotice] = useState<string | null>(null);

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
    if (!file) return;
    setCameraAppsNotice(null);
    onSelectFile(file);
  };

  const getUnavailableMessage = (mode: "default" | "chooser") => {
    if (cameraAppsAvailability === "checking") return "카메라 앱을 확인하고 있습니다.";
    if (cameraAppsAvailability === "web") {
      return mode === "chooser"
        ? "다른 카메라 앱 선택은 Android 앱에서 사용할 수 있습니다."
        : "웹에서는 기기의 기본 촬영 화면을 사용합니다.";
    }
    if (cameraAppsAvailability === "camera-unavailable") {
      return "촬영할 수 있는 카메라 앱을 찾지 못했습니다. 앨범에서 선택해 주세요.";
    }
    return "현재 앱 버전에서는 카메라 앱을 연결할 수 없습니다. 앨범에서 선택해 주세요.";
  };

  const openDefaultCamera = () => {
    setCameraAppsNotice(null);
    if (cameraAppsAvailability === "web") {
      fallbackCameraInputRef.current?.click();
      return;
    }
    if (cameraAppsAvailability === "available") {
      onCapture("default");
      return;
    }
    setCameraAppsNotice(getUnavailableMessage("default"));
  };

  const openCameraAppChooser = () => {
    setCameraAppsNotice(null);
    if (cameraAppsAvailability === "available") {
      onCapture("chooser");
      return;
    }
    setCameraAppsNotice(getUnavailableMessage("chooser"));
  };

  const isPreviewing = Boolean(previewFile);
  const confirmLabel = action.buttonLabel.replace("사진 찍고", "사진 등록하고");

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0d1726]/45 pt-12" onClick={onClose}>
      <section
        aria-label="사진 등록"
        aria-modal="true"
        role="dialog"
        className="w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#fbfcfe] shadow-[0_-18px_48px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d6deea]" />
        <div className="flex items-start justify-between px-5 pb-4 pt-4">
          <div>
            <h2 className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#14213a]">
              {isPreviewing ? "이 사진으로 진행할까요?" : action.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="닫기"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#526276] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

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
                className="flex min-h-[52px] items-center justify-center gap-1.5 rounded-[14px] border border-[#d7e0eb] bg-white px-3 text-[16px] font-medium leading-6 text-[#526276] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" /> 다시 선택
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="min-h-[52px] rounded-[14px] bg-[#286bd1] px-3 text-[16px] font-medium leading-6 tracking-[-0.005em] text-white shadow-[0_7px_15px_rgba(40,107,209,0.25)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-55"
              >
                {busy ? "사진 등록 중…" : confirmLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-5">
            <input
              ref={libraryInputRef}
              type="file"
              accept="image/*"
              hidden
              disabled={busy}
              onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={fallbackCameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              hidden
              disabled={busy}
              onChange={(event) => {
                chooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <button
              type="button"
              disabled={busy || cameraAppsAvailability === "checking"}
              onClick={openDefaultCamera}
              className="flex min-h-[72px] w-full items-center gap-3 rounded-[18px] border border-[#a9c8f4] bg-[#eaf3ff] px-4 py-3 text-left shadow-[0_8px_18px_rgba(62,125,210,0.12)] transition active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-55"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#286bd1] text-white shadow-[0_5px_11px_rgba(40,107,209,0.24)]"><Camera className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1 text-[16px] font-medium leading-6 tracking-[-0.005em] text-[#1b457c]">기본 카메라로 촬영</span>
            </button>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={busy || cameraAppsAvailability === "checking"}
                onClick={openCameraAppChooser}
                className="flex min-h-[64px] items-center gap-2.5 rounded-[16px] border border-[#e0e6ef] bg-white px-3 text-left active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#f0edfb] text-[#6751aa]"><Camera className="h-[18px] w-[18px]" /></span>
                <span className="text-[16px] font-medium leading-6 text-[#3b3157]">다른 카메라 앱</span>
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => libraryInputRef.current?.click()}
                className="flex min-h-[64px] items-center gap-2.5 rounded-[16px] border border-[#e0e6ef] bg-white px-3 text-left active:scale-[0.99] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-[#edf1f5] text-[#526276]"><ImagePlus className="h-[18px] w-[18px]" /></span>
                <span className="text-[16px] font-medium leading-6 text-[#2c3b50]">앨범에서 선택</span>
              </button>
            </div>

            {cameraAppsNotice ? <p role="status" aria-live="polite" className="mt-3 text-[13px] font-normal leading-5 text-[#64748b]">{cameraAppsNotice}</p> : null}
            {allowSkip ? <button type="button" onClick={onSkip} disabled={busy} className="mt-2 min-h-11 w-full px-3 text-[16px] font-medium leading-6 text-[#64748b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2563eb] disabled:opacity-50">{action.skipLabel}</button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
