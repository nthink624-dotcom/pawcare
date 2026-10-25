import type { BusinessHours, RegularClosedCycle } from "@/types/domain";

export type SetupClosureCycle = Exclude<RegularClosedCycle, "biweekly">;

export function unifiedHoursPolicy(hours: BusinessHours, cycle: SetupClosureCycle) {
  const regularClosedDays = [0, 1, 2, 3, 4, 5, 6].filter((day) => !hours[day]?.enabled);
  const businessHours: BusinessHours = Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((day) => [day, {
    open: hours[day]?.open ?? "", close: hours[day]?.close ?? "",
    enabled: cycle === "weekly" ? Boolean(hours[day]?.enabled) : true,
  }]));
  return { businessHours, regularClosedDays };
}

export function restoreTemporaryClosedDates(current: string[], draft?: string[], baseline?: string[]) {
  if (!draft) return current;
  if (!baseline) return [...new Set([...current, ...draft])].sort();
  const removed = baseline.filter((date) => !draft.includes(date));
  const added = draft.filter((date) => !baseline.includes(date));
  return [...new Set([...current.filter((date) => !removed.includes(date)), ...added])].sort();
}

export function bookingBoundsFromHours(hours: BusinessHours) {
  const enabled = Object.values(hours).filter((value) => value?.enabled);
  const starts = enabled.map((value) => value!.open).filter(Boolean).sort();
  const ends = enabled.map((value) => value!.close).filter(Boolean).sort();
  return { bookingStart: starts[0] ?? "", bookingEnd: ends.at(-1) ?? "" };
}

export function validateClosedPolicy(cycle: RegularClosedCycle, anchor: string, days: number[], hours: BusinessHours) {
  if (cycle !== "weekly" && days.some((day) => !hours[day]?.enabled)) throw new Error("주기적으로 쉬는 요일은 위 영업요일에도 체크해 주세요. 쉬지 않는 주의 영업시간이 필요합니다.");
  if (cycle === "weekly" && !Object.entries(hours).some(([day, value]) => value?.enabled && !days.includes(Number(day)))) throw new Error("영업일을 한 개 이상 남겨 주세요.");
  if (cycle === "biweekly" && days.length) {
    const date = new Date(`${anchor}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(anchor) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== anchor) throw new Error("격주로 쉬는 주의 기준일을 선택해 주세요.");
  }
}
