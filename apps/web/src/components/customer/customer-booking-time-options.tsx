"use client";

import { IconChevronDown as ChevronDown } from "@tabler/icons-react";
import { useId, useState } from "react";

const maxVisibleRecommendations = 3;

function TimeChips({ slots, value, onSelect, label }: {
  slots: string[];
  value: string;
  onSelect: (slot: string) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="grid grid-cols-3 gap-2">
      {slots.map((slot) => (
        <button
          key={slot}
          type="button"
          aria-pressed={slot === value}
          onClick={() => onSelect(slot)}
          className="min-h-11 rounded-[10px] border border-[#ded7d1] bg-white px-1 text-center text-[16px] font-medium tabular-nums text-[#3a2e2a] hover:border-[#ad6254] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ad6254] aria-pressed:border-[#ad6254] aria-pressed:bg-[#fcece7] aria-pressed:text-[#7a382d]"
        >
          {slot}
        </button>
      ))}
    </div>
  );
}

export default function CustomerBookingTimeOptions({
  slots,
  recommendedSlots,
  recommendationSource,
  allowOtherAvailableTimes,
  value,
  onSelect,
}: {
  slots: string[];
  recommendedSlots: string[];
  recommendationSource?: "ai" | "rule";
  allowOtherAvailableTimes: boolean;
  value: string;
  onSelect: (slot: string) => void;
}) {
  const detailsId = useId();
  const [expandedOverride, setExpandedOverride] = useState<boolean>();
  const available = new Set(slots);
  const ranked = [...new Set(recommendedSlots)].filter((slot) => available.has(slot));
  const recommended = ranked.slice(0, maxVisibleRecommendations);

  // An existing choice can be restored from before the visible list was capped.
  if (!allowOtherAvailableTimes && ranked.includes(value) && !recommended.includes(value)) {
    recommended[maxVisibleRecommendations - 1] = value;
  }

  const otherSlots = [...available].filter((slot) => !recommended.includes(slot)).sort();
  const canExpand = allowOtherAvailableTimes && otherSlots.length > 0;
  const expanded = expandedOverride ?? otherSlots.includes(value);
  const recommendationLabel = recommendationSource === "ai" ? "AI 추천 시간" : "추천 시간";

  if (recommended.length === 0) {
    return <TimeChips slots={otherSlots} value={value} onSelect={onSelect} label="예약 가능한 시간" />;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <p className="text-[14px] font-medium text-[#3a2e2a]">{recommendationLabel}</p>
        <TimeChips slots={recommended} value={value} onSelect={onSelect} label={recommendationLabel} />
      </div>
      {canExpand ? (
        <>
          <button
            type="button"
            aria-controls={detailsId}
            aria-expanded={expanded}
            onClick={() => setExpandedOverride(!expanded)}
            className="flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[10px] border border-[#ded7d1] bg-white px-3 text-[14px] font-medium text-[#3a2e2a] hover:border-[#ad6254] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ad6254]"
          >
            {expanded ? "다른 시간 접기" : "다른 예약 시간 보기"}
            <ChevronDown aria-hidden="true" size={16} className={expanded ? "rotate-180" : undefined} />
          </button>
          <div id={detailsId} hidden={!expanded}>
            {expanded ? <TimeChips slots={otherSlots} value={value} onSelect={onSelect} label="다른 예약 가능한 시간" /> : null}
          </div>
        </>
      ) : null}
    </div>
  );
}
