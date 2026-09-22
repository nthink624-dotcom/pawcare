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
      data-testid="price-guide-onboarding-choice"
    >
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {choices.map(({ mode, title, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="flex min-h-[88px] min-w-0 items-center gap-4 rounded-[14px] border border-[#cfd9e5] bg-white px-5 py-4 text-left transition hover:border-[#94a3b8] hover:bg-[#fbfcfd] active:bg-[#f4f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
          >
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f8] text-[#42536a]">
              <Icon className="h-5.5 w-5.5" aria-hidden="true" />
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
