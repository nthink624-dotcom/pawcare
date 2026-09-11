"use client";

import { Camera, ChevronRight, Play, X } from "lucide-react";

type Stage = "early-confirm" | "choices";

export default function OwnerMobileGroomingStartSheet({
  stage,
  busy,
  onClose,
  onConfirmEarly,
  onPhotoStart,
  onStartWithoutPhoto,
}: {
  stage: Stage;
  busy: boolean;
  onClose: () => void;
  onConfirmEarly: () => void;
  onPhotoStart: () => void;
  onStartWithoutPhoto: () => void;
}) {
  const isEarlyConfirm = stage === "early-confirm";

  return (
    <div className="fixed inset-0 z-[70] flex items-end bg-[#0d1726]/45 px-3 pt-12" onClick={onClose}>
      <section
        aria-label={isEarlyConfirm ? "이른 미용 시작 확인" : "미용 시작 방법 선택"}
        className="w-full overflow-hidden rounded-t-[28px] bg-[#fbfcfe] shadow-[0_-18px_48px_rgba(15,23,42,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[#d6deea]" />
        <header className="flex items-start justify-between px-5 pb-4 pt-4">
          <div>
            <p className="text-[12px] font-semibold tracking-[0.08em] text-[#4e82cf]">
              {isEarlyConfirm ? "예약 시간 전" : "미용 시작"}
            </p>
            <h2 className="mt-1 text-[20px] font-semibold tracking-[-0.04em] text-[#14213a]">
              {isEarlyConfirm ? "예약 시간 전입니다. 시작할까요?" : "어떻게 시작할까요?"}
            </h2>
            {!isEarlyConfirm ? <p className="mt-1 text-[13px] leading-5 text-[#64748b]">미용 전 사진은 선택 사항이에요.</p> : null}
          </div>
          <button
            type="button"
            aria-label="닫기"
            disabled={busy}
            onClick={onClose}
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#eef2f7] text-[#526276] disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {isEarlyConfirm ? (
          <div className="grid grid-cols-2 gap-2 px-5 pb-5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="h-[52px] rounded-[14px] border border-[#d7e0eb] bg-white text-[14px] font-semibold text-[#526276] disabled:opacity-50"
            >
              아니요
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onConfirmEarly}
              className="h-[52px] rounded-[14px] bg-[#286bd1] text-[14px] font-semibold text-white shadow-[0_7px_15px_rgba(40,107,209,0.25)] disabled:opacity-55"
            >
              예, 시작할게요
            </button>
          </div>
        ) : (
          <div className="space-y-2 px-5 pb-5">
            <button
              type="button"
              disabled={busy}
              onClick={onPhotoStart}
              className="group flex min-h-[72px] w-full items-center gap-3 rounded-[18px] border border-[#a9c8f4] bg-[#eaf3ff] px-4 text-left shadow-[0_8px_18px_rgba(62,125,210,0.12)] disabled:opacity-55"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#286bd1] text-white"><Camera className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[16px] font-semibold tracking-[-0.03em] text-[#1b457c]">사진 촬영 후 시작</span><span className="mt-0.5 block text-[12px] text-[#5b7da8]">촬영 후 미리보기에서 등록을 확정해요</span></span>
              <ChevronRight className="h-5 w-5 shrink-0 text-[#6b94c8]" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={onStartWithoutPhoto}
              className="flex min-h-[62px] w-full items-center gap-3 rounded-[18px] border border-[#e0e6ef] bg-white px-4 text-left disabled:opacity-55"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#edf1f5] text-[#526276]"><Play className="ml-0.5 h-4 w-4 fill-current" /></span>
              <span><span className="block text-[16px] font-semibold tracking-[-0.03em] text-[#2c3b50]">사진 없이 바로 시작</span><span className="mt-0.5 block text-[12px] text-[#748196]">사진을 남기지 않고 바로 진행해요</span></span>
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
