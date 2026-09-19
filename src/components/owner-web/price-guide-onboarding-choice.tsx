"use client";

import { Camera, PencilLine } from "lucide-react";

export type PriceGuideOnboardingChoiceMode = "photo" | "manual";

const choices: Array<{
  mode: PriceGuideOnboardingChoiceMode;
  title: string;
  Icon: typeof Camera;
}> = [
  {
    mode: "photo",
    title: "사진으로 등록",
    Icon: Camera,
  },
  {
    mode: "manual",
    title: "직접 등록",
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
      <h2 id="price-guide-registration-title" className="text-[20px] font-semibold leading-7 tracking-[-0.015em] text-[#172033]">요금표 등록</h2>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {choices.map(({ mode, title, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="flex min-h-11 min-w-0 items-center gap-3 rounded-[14px] border border-[#cfd9e5] bg-white px-4 py-3 text-left transition hover:border-[#94a3b8] hover:bg-[#fbfcfd] active:bg-[#f4f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f8] text-[#42536a]">
              <Icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-[16px] font-medium leading-6 text-[#172033]">{title}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
