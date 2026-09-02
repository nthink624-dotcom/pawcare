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
    title: "사진으로 요금표 만들기",
    Icon: Camera,
  },
  {
    mode: "manual",
    title: "직접 요금표 만들기",
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
      className="min-w-0 space-y-2"
      aria-label="요금표 입력 방법"
      data-testid="price-guide-onboarding-choice"
    >
      <h3 className="text-[14px] font-medium leading-5 text-[#334155]">입력 방법</h3>
      <div className="grid min-w-0 gap-3 sm:grid-cols-2">
        {choices.map(({ mode, title, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className={mode === "photo"
              ? "inline-flex min-h-[72px] min-w-0 items-center justify-center gap-3 rounded-[12px] border border-[#b8cce6] bg-[#eff5ff] px-5 py-4 text-[16px] font-medium leading-6 text-[#14213b] transition hover:border-[#8ba9ce] hover:bg-[#e8f1ff] active:border-[#7596bd] active:bg-[#deebfb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"
              : "inline-flex min-h-[72px] min-w-0 items-center justify-center gap-3 rounded-[12px] border border-[#cfd9e5] bg-white px-5 py-4 text-[16px] font-medium leading-6 text-[#172033] transition hover:border-[#94a3b8] hover:bg-[#fbfcfd] active:border-[#94a3b8] active:bg-[#f4f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2"}
          >
            <Icon className={mode === "photo" ? "h-6 w-6 shrink-0 text-[#14213b]" : "h-6 w-6 shrink-0 text-[#42536a]"} aria-hidden="true" />
            <span>{title}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
