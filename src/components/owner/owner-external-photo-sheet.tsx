"use client";

import { Images, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from "react";

import {
  getExternalCameraCapabilities,
  type ExternalCameraCapabilities,
} from "@/lib/media/external-camera";

type PhotoAction = {
  phase?: "start" | "completion";
  title: string;
  description: string;
  buttonLabel: string;
  skipLabel: string;
};

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled]):not([tabindex='-1'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export default function OwnerExternalPhotoSheet({
  action,
  busy,
  canUseCameraApps,
  previewFile,
  recoveredPreview = false,
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
  recoveredPreview?: boolean;
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
  const dialogRef = useRef<HTMLElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const libraryInputRef = useRef<HTMLInputElement | null>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const [cameraCapabilities, setCameraCapabilities] = useState<ExternalCameraCapabilities | null>(null);

  useEffect(() => {
    let active = true;
    if (!canUseCameraApps) return () => { active = false; };
    void getExternalCameraCapabilities().then((capabilities) => {
      if (active) setCameraCapabilities(capabilities);
    });
    return () => { active = false; };
  }, [canUseCameraApps]);

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

  const chooseFile = (file: File | undefined, input: HTMLInputElement) => {
    input.value = "";
    if (file) onSelectFile(file);
  };

  const isPreviewing = Boolean(previewFile);
  const isCompletion = action.phase === "completion" || (!action.phase && /완료|미용 후/.test(action.title));
  const sheetTitle = isCompletion ? "미용 후 사진 촬영" : "미용 전 사진 촬영";
  const confirmLabel = isCompletion ? "사진 등록 후 완료" : "사진 등록 후 시작";
  const actionColor = isCompletion ? "#5B3A8C" : "#286bd1";
  const cameraUnavailable = cameraCapabilities?.availableAppCount === 0;
  const chooserUnavailable = cameraCapabilities?.canChoose === false;
  const controlsDisabled = busy || cameraUnavailable;

  useEffect(() => {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => returnFocusRef.current?.focus();
  }, []);

  useEffect(() => {
    initialFocusRef.current?.focus();
  }, [isPreviewing]);

  function handleDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      if (!busy) {
        event.preventDefault();
        onClose();
      }
      return;
    }
    if (event.key !== "Tab" || !dialogRef.current) return;

    const focusableElements = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
    if (focusableElements.length === 0) {
      event.preventDefault();
      dialogRef.current.focus();
      return;
    }

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];
    const activeElement = document.activeElement;
    if (event.shiftKey && (activeElement === firstElement || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && (activeElement === lastElement || !dialogRef.current.contains(activeElement))) {
      event.preventDefault();
      firstElement.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[#0d1726]/45 pt-12" onClick={onClose}>
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={sheetTitle}
        tabIndex={-1}
        className="w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[#fbfcfe] shadow-[0_-18px_48px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d6deea]" />
        <header className="flex items-start justify-between gap-3 px-5 pb-4 pt-4">
          <h2 className="min-w-0 pt-2 text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#14213a] [overflow-wrap:anywhere]">
            {isPreviewing ? "이 사진으로 진행할까요?" : sheetTitle}
          </h2>
          <button
            ref={initialFocusRef}
            type="button"
            aria-label="닫기"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#526276] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        {isPreviewing ? (
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            {recoveredPreview ? (
              <p role="status" className="mb-3 text-[13px] font-normal leading-5 text-[#526b84]">
                선택한 사진을 복구했어요.
              </p>
            ) : null}
            <div className="overflow-hidden rounded-[18px] border border-[#dce5f1] bg-white p-2">
              <img ref={setPreviewImage} alt="등록할 사진 미리보기" className="h-[248px] w-full rounded-[14px] bg-[#f2f5f9] object-contain" />
            </div>
            <div className="mt-4 grid grid-cols-[0.9fr_1.4fr] gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={onClearPreview}
                className="flex h-[52px] items-center justify-center gap-1.5 rounded-[14px] border border-[#d7e0eb] bg-white px-3 text-[16px] font-medium leading-6 text-[#526276] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> 다시 선택
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onConfirm}
                className="h-[52px] rounded-[14px] px-3 text-[16px] font-medium leading-6 text-white outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-55"
                style={{ backgroundColor: actionColor }}
              >
                {busy ? "사진 등록 중…" : confirmLabel}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-5 pb-[calc(env(safe-area-inset-bottom)+20px)]">
            <input ref={libraryInputRef} id={libraryInputId} type="file" accept="image/*" tabIndex={-1} aria-hidden="true" className="sr-only" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0], event.currentTarget)} />
            <input ref={fallbackCameraInputRef} id={fallbackCameraInputId} type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" className="sr-only" disabled={busy} onChange={(event) => chooseFile(event.target.files?.[0], event.currentTarget)} />

            {canUseCameraApps ? (
              <button
                type="button"
                disabled={controlsDisabled || chooserUnavailable}
                onClick={() => onCapture("chooser")}
                className="flex h-[52px] w-full items-center justify-center rounded-[14px] border border-[#d7e0eb] bg-white px-4 text-[16px] font-medium leading-6 text-[#263b53] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-45"
              >
                다른 카메라 앱으로 촬영
              </button>
            ) : null}

            <div className={`${canUseCameraApps ? "mt-2" : ""} grid grid-cols-[minmax(0,1fr)_52px] gap-2`}>
              <button
                type="button"
                disabled={controlsDisabled}
                onClick={() => canUseCameraApps ? onCapture("default") : fallbackCameraInputRef.current?.click()}
                className="flex h-[52px] min-w-0 items-center justify-center rounded-[14px] border border-[#a9c8f4] bg-[#eaf3ff] px-3 text-[16px] font-medium leading-6 text-[#1b457c] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-45"
              >
                기본 카메라로 촬영
              </button>
              <button
                type="button"
                aria-label="앨범에서 선택"
                disabled={busy}
                onClick={() => libraryInputRef.current?.click()}
                className="flex h-[52px] w-[52px] items-center justify-center rounded-[14px] border border-[#d7e0eb] bg-white text-[#526276] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50"
              >
                <Images className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {cameraUnavailable ? <p role="alert" className="mt-2 text-[13px] font-normal leading-5 text-[#9a5e4e]">사용할 수 있는 카메라 앱이 없습니다. 앨범에서 선택해 주세요.</p> : null}
            {allowSkip ? <button type="button" onClick={onSkip} disabled={busy} className="mt-2 min-h-11 w-full rounded-[10px] px-3 text-[16px] font-medium leading-6 text-[#64748b] outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 disabled:opacity-50">{action.skipLabel}</button> : null}
          </div>
        )}
      </section>
    </div>
  );
}
