"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const chipGapPx = 6;

type BreedChip = {
  id: string;
  label: string;
};

function packChips(chips: BreedChip[], widths: Map<string, number>, availableWidth: number) {
  const remaining = [...chips];
  const packed: BreedChip[] = [];

  while (remaining.length > 0) {
    const first = remaining.shift();
    if (!first) break;

    packed.push(first);
    let usedWidth = widths.get(first.id) ?? availableWidth;

    for (let index = 0; index < remaining.length; ) {
      const candidate = remaining[index];
      const candidateWidth = widths.get(candidate.id) ?? availableWidth;

      if (usedWidth + chipGapPx + candidateWidth <= availableWidth) {
        packed.push(candidate);
        usedWidth += chipGapPx + candidateWidth;
        remaining.splice(index, 1);
        continue;
      }

      index += 1;
    }
  }

  return packed;
}

export function DenseBreedChipList({ breeds, groupKey }: { breeds: string[]; groupKey: string }) {
  const chips = useMemo(
    () => breeds.map((label, index) => ({ id: `${groupKey}-${index}`, label })),
    [breeds, groupKey],
  );
  const [orderedChips, setOrderedChips] = useState(chips);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef(new Map<string, HTMLSpanElement>());

  useEffect(() => {
    setOrderedChips(chips);
  }, [chips]);

  const arrangeChips = useCallback(() => {
    const container = containerRef.current;
    if (!container || container.clientWidth <= 0) return;

    const widths = new Map<string, number>();
    chips.forEach((chip) => {
      const element = chipRefs.current.get(chip.id);
      if (element) widths.set(chip.id, element.getBoundingClientRect().width);
    });
    if (widths.size !== chips.length) return;

    const nextChips = packChips(chips, widths, container.clientWidth);
    setOrderedChips((current) => {
      const unchanged = current.length === nextChips.length && current.every((chip, index) => chip.id === nextChips[index]?.id);
      return unchanged ? current : nextChips;
    });
  }, [chips]);

  useEffect(() => {
    arrangeChips();
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(arrangeChips);
    observer.observe(container);
    return () => observer.disconnect();
  }, [arrangeChips]);

  return (
    <div className="px-4 pb-3">
      <div ref={containerRef} className="flex flex-wrap gap-1.5">
        {orderedChips.map((chip) => (
          <span
            key={chip.id}
            ref={(element) => {
              if (element) chipRefs.current.set(chip.id, element);
              else chipRefs.current.delete(chip.id);
            }}
            className="inline-flex h-7 items-center rounded-full border border-[#f2cfc8] bg-[#fff8f6] px-2 text-[13px] font-normal text-[#6d4b43]"
          >
            {chip.label}
          </span>
        ))}
      </div>
    </div>
  );
}
