"use client";

import { Camera, PencilLine } from "lucide-react";

export type PriceGuideOnboardingChoiceMode = "photo" | "manual";

const choices: Array<{
  mode: PriceGuideOnboardingChoiceMode;
  title: string;
  description: string;
  Icon: typeof Camera;
}> = [
  {
    mode: "photo",
    title: "사진으로 등록",
    description: "기존 요금표 사진을 올려요.",
    Icon: Camera,
  },
  {
    mode: "manual",
    title: "직접 등록",
    description: "서비스와 요금을 직접 입력해요.",
    Icon: PencilLine,
  },
];

export default function PriceGuideOnboardingChoice({
  onSelect,
}: {
  onSelect: (mode: PriceGuideOnboardingChoiceMode) => void;
}) {
  return (
    <section
      className="min-w-0 space-y-4"
      aria-labelledby="price-guide-registration-title"
      data-testid="price-guide-onboarding-choice"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 id="price-guide-registration-title" className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033]">요금표 등록</h2>
        <span className="inline-flex min-h-7 items-center rounded-full border border-[#d8e0e8] bg-[#f8fafc] px-2.5 text-[12px] font-medium text-[#607080]" data-price-guide-registration-status="empty">
          요금표 미등록
        </span>
      </div>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {choices.map(({ mode, title, description, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="flex min-h-24 min-w-0 items-center gap-3 rounded-[14px] border border-[#cfd9e5] bg-white px-5 py-4 text-left transition hover:border-[#94a3b8] hover:bg-[#fbfcfd] active:bg-[#f4f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f8] text-[#42536a]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-medium leading-6 text-[#172033]">{title}</span>
              <span className="mt-1 block text-[13px] font-normal leading-5 text-[#64748b]">{description}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
