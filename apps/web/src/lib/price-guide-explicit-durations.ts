import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";
import type { WeightDurationTarget, WeightDurationUpdate } from "@/lib/price-guide-weight-duration-proposal";

/** Only explicitly entered values in this group/service can change. Blank stays unknown. */
export function explicitDurationUpdates(targets: WeightDurationTarget[], values: Record<number, string>): WeightDurationUpdate[] {
  return targets.flatMap((target) => {
    const value = values[target.rowIndex]?.trim();
    if (!value) return [];
    const minutes = Number(value);
    if (!isConfirmedPriceGuideDuration(minutes)) throw new Error("예상시간은 15~480분 사이의 정수로 입력해 주세요.");
    return minutes === target.durationMinutes ? [] : [{ rowIndex: target.rowIndex, durationMinutes: minutes }];
  });
}
