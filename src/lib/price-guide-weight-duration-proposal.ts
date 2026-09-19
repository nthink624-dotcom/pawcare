import { isConfirmedPriceGuideDuration } from "@/lib/price-guide-duration-confirmation";
import type { PriceGuideV2 } from "@/types/price-guide-photo-import";

export type WeightDurationRule = { baseKg: number; baseMinutes: number; stepKg: number; incrementMinutes: number };
export type WeightDurationTarget = { rowIndex: number; minKg: number | null; maxKg: number | null; durationMinutes: number | null };
export type WeightDurationProposal = WeightDurationTarget & { proposedDurationMinutes: number | null; previewDurationMinutes: number | null; needsDirectInput: boolean; reason: string | null };
export type WeightDurationUpdate = { rowIndex: number; durationMinutes: number };

export function isValidWeightDurationRule(rule: WeightDurationRule) {
  return Number.isFinite(rule.baseKg) && rule.baseKg >= 0
    && isConfirmedPriceGuideDuration(rule.baseMinutes)
    && Number.isFinite(rule.stepKg) && rule.stepKg > 0
    && Number.isFinite(rule.incrementMinutes) && rule.incrementMinutes >= 0;
}

export function proposeWeightDuration(target: WeightDurationTarget, rule: WeightDurationRule): WeightDurationProposal {
  if (!isValidWeightDurationRule(rule)) return { ...target, proposedDurationMinutes: null, previewDurationMinutes: target.durationMinutes, needsDirectInput: true, reason: "기준값을 확인해 주세요." };
  if (target.maxKg === null || !Number.isFinite(target.maxKg) || target.maxKg < 0) return { ...target, proposedDurationMinutes: null, previewDurationMinutes: target.durationMinutes, needsDirectInput: true, reason: "직접 입력" };
  if (target.minKg !== null && (!Number.isFinite(target.minKg) || target.minKg < 0 || target.minKg > target.maxKg)) return { ...target, proposedDurationMinutes: null, previewDurationMinutes: target.durationMinutes, needsDirectInput: true, reason: "체중 확인" };
  const proposedDurationMinutes = rule.baseMinutes + Math.ceil(Math.max(0, target.maxKg - rule.baseKg) / rule.stepKg) * rule.incrementMinutes;
  if (!isConfirmedPriceGuideDuration(proposedDurationMinutes)) return { ...target, proposedDurationMinutes: null, previewDurationMinutes: target.durationMinutes, needsDirectInput: true, reason: "직접 입력" };
  return { ...target, proposedDurationMinutes, previewDurationMinutes: isConfirmedPriceGuideDuration(target.durationMinutes) ? target.durationMinutes : proposedDurationMinutes, needsDirectInput: false, reason: null };
}

export function proposeWeightDurations(targets: WeightDurationTarget[], rule: WeightDurationRule) { return targets.map((target) => proposeWeightDuration(target, rule)); }

/** Applies only explicit preview values addressed by their canonical row indexes. */
export function applyWeightDurationUpdates(document: PriceGuideV2, updates: WeightDurationUpdate[]): PriceGuideV2 {
  const nextByRowIndex = new Map(updates.filter((update) => Number.isInteger(update.rowIndex) && isConfirmedPriceGuideDuration(update.durationMinutes)).map((update) => [update.rowIndex, update.durationMinutes]));
  if (nextByRowIndex.size === 0) return document;
  let changed = false;
  const rows = document.rows.map((row, rowIndex) => { const durationMinutes = nextByRowIndex.get(rowIndex); if (durationMinutes === undefined || row.durationMinutes === durationMinutes) return row; changed = true; return { ...row, durationMinutes }; });
  return changed ? { ...document, rows } : document;
}
