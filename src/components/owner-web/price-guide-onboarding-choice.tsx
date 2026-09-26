"use client";

import { Camera, PencilLine } from "lucide-react";

import { OWNER_TYPOGRAPHY } from "@/components/owner-web/owner-typography";

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
    description: "사진 한 장으로 요금표를 빠르게 시작할 수 있어요.",
    Icon: Camera,
  },
  {
    mode: "manual",
    title: "직접 등록",
    description: "서비스와 가격을 직접 입력할 수 있어요.",
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
      <div className="relative top-2 grid min-w-0 w-full gap-3 sm:grid-cols-2">
        {choices.map(({ mode, title, description, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="flex min-h-[100px] min-w-0 items-center gap-3 rounded-[14px] border border-[#cfd9e5] bg-white px-4 py-4 text-left transition hover:border-[#94a3b8] hover:bg-[#fbfcfd] active:bg-[#f4f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563eb] focus-visible:ring-offset-2 sm:px-5"
          >
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#f1f4f8] text-[#42536a]">
              <Icon className="h-5.5 w-5.5" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className={`block ${OWNER_TYPOGRAPHY.bodyStrong} text-[#172033]`}>{title}</span>
              <span
                className={`mt-0.5 block ${OWNER_TYPOGRAPHY.helper} text-[#64748b] [overflow-wrap:anywhere] [word-break:keep-all]`}
                data-price-guide-choice-description={mode}
              >
                {description}
              </span>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
