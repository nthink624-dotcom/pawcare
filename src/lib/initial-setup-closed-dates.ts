import { z } from "zod";

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "휴무 날짜를 확인해 주세요.");

export const temporaryClosedDateChangesSchema = z.object({
  add: z.array(dateKey).max(730), remove: z.array(dateKey).max(730),
}).strict().refine(({ add, remove }) => new Set(add).size === add.length && new Set(remove).size === remove.length && !add.some((date) => remove.includes(date)), "중복된 휴무 날짜를 확인해 주세요.");

export type TemporaryClosedDateChanges = z.infer<typeof temporaryClosedDateChangesSchema>;

export function mergeTemporaryClosedDates(current: string[], changes: TemporaryClosedDateChanges) {
  return [...new Set([...current.filter((date) => !changes.remove.includes(date)), ...changes.add])].sort();
}
