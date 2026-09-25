import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export const PRICE_GUIDE_DURATION_MINUTES_MIN = 15;
export const PRICE_GUIDE_DURATION_MINUTES_MAX = 480;
export const PRICE_GUIDE_DURATION_QUICK_OPTIONS = [30, 60, 90, 120] as const;

export function isConfirmedPriceGuideDuration(value: number | null | undefined): value is number {
  return Number.isInteger(value)
    && value! >= PRICE_GUIDE_DURATION_MINUTES_MIN
    && value! <= PRICE_GUIDE_DURATION_MINUTES_MAX;
}

function serviceKey(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("ko-KR");
}

export type PriceGuideServiceDurationGroup = {
  key: string;
  serviceName: string;
  rowIndexes: number[];
  confirmedDurations: number[];
  unresolvedCount: number;
};

export function groupPriceGuideRowsByServiceDuration(
  document: Pick<PriceGuideV2, "rows">,
): PriceGuideServiceDurationGroup[] {
  const groups = new Map<string, PriceGuideServiceDurationGroup>();

  document.rows.forEach((row, rowIndex) => {
    const key = serviceKey(row.serviceName);
    if (!key) return;
    const current = groups.get(key) ?? {
      key,
      serviceName: row.serviceName!.trim(),
      rowIndexes: [],
      confirmedDurations: [],
      unresolvedCount: 0,
    };
    current.rowIndexes.push(rowIndex);
    if (isConfirmedPriceGuideDuration(row.durationMinutes)) {
      if (!current.confirmedDurations.includes(row.durationMinutes)) {
        current.confirmedDurations.push(row.durationMinutes);
      }
    } else {
      current.unresolvedCount += 1;
    }
    groups.set(key, current);
  });

  return Array.from(groups.values()).map((group) => ({
    ...group,
    confirmedDurations: group.confirmedDurations.sort((left, right) => left - right),
  }));
}

export function applyConfirmedDurationToService(
  document: PriceGuideV2,
  serviceName: string,
  durationMinutes: number,
): PriceGuideV2 {
  const key = serviceKey(serviceName);
  if (!key || !isConfirmedPriceGuideDuration(durationMinutes)) return document;
  let changed = false;
  const rows = document.rows.map((row) => {
    if (serviceKey(row.serviceName) !== key || row.durationMinutes === durationMinutes) return row;
    changed = true;
    return { ...row, durationMinutes };
  });
  return changed ? { ...document, rows } : document;
}
