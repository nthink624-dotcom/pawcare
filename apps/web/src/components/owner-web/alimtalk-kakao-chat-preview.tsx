"use client";

import Image from "next/image";
import { ChevronLeft, Ellipsis, Search } from "lucide-react";

import { PETMANAGER_BRAND_MARK_SRC, PETMANAGER_MASTER_BRAND_NAME, PETMANAGER_SERVICE_NAME } from "@/lib/brand";

export function AlimtalkKakaoChatPreview({
  message,
  buttons = [],
  senderName = PETMANAGER_SERVICE_NAME,
  timestamp = "오후 1:34",
}: {
  message: string;
  buttons?: string[];
  senderName?: string;
  timestamp?: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[360px] overflow-hidden rounded-[10px] bg-[#b2c7d5] px-3 pb-4 pt-2 text-[#202124]">
      <div className="flex h-10 items-center gap-2 px-1 text-[#28343c]" aria-hidden="true">
        <ChevronLeft className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-[16px] font-medium leading-6">{senderName}</span>
        <Search className="h-[18px] w-[18px] shrink-0" />
        <Ellipsis className="h-5 w-5 shrink-0" />
      </div>

      <div className="flex justify-center py-3">
        <span className="rounded-full bg-[#9fb4c2]/70 px-2.5 py-1 text-[12px] font-normal leading-[18px] text-white">오늘</span>
      </div>

      <div className="flex items-start gap-2">
        <Image
          src={PETMANAGER_BRAND_MARK_SRC}
          alt={PETMANAGER_MASTER_BRAND_NAME}
          width={32}
          height={32}
          className="mt-5 h-8 w-8 shrink-0 rounded-full bg-white object-contain p-1"
        />
        <div className="min-w-0 max-w-[286px] flex-1">
          <p className="mb-1 text-[12px] font-normal leading-[18px] text-[#34414a]">{senderName}</p>
          <div className="relative overflow-hidden rounded-[2px_12px_12px_12px] bg-white">
            <div className="flex min-h-9 items-center gap-1.5 bg-[#ffe500] px-3 py-1.5 text-[14px] font-medium leading-5 text-[#202124]">
              알림톡 도착
            </div>
            <div className="whitespace-pre-wrap break-words px-3 py-3 text-[14px] font-normal leading-5 text-[#202124]">{message}</div>
            {buttons.map((button, index) => (
              <div
                key={`${button}-${index}`}
                className="flex min-h-11 items-center justify-center border-t border-[#e9e9e9] bg-[#f7f7f7] px-3 py-2 text-center text-[14px] font-medium leading-5 text-[#202124]"
              >
                {button}
              </div>
            ))}
          </div>
          <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#45515a]">{timestamp}</p>
        </div>
      </div>
    </div>
  );
}
