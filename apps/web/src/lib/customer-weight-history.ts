import type { GroomingRecord } from "@/types/domain";

export type CustomerWeightMeasurement = {
  measuredAt: string;
  weightKg: number;
};

export function buildCustomerWeightHistory(
  records: GroomingRecord[],
  petId: string,
  limit = 12,
  fallback?: CustomerWeightMeasurement | null,
): CustomerWeightMeasurement[] {
  const history = records
    .filter(
      (record) =>
        record.pet_id === petId &&
        typeof record.pet_weight_snapshot === "number" &&
        Number.isFinite(record.pet_weight_snapshot) &&
        record.pet_weight_snapshot > 0 &&
        Boolean(record.groomed_at),
    )
    .sort((a, b) => new Date(a.groomed_at).getTime() - new Date(b.groomed_at).getTime())
    .slice(-Math.max(1, limit))
    .map((record) => ({
      measuredAt: record.groomed_at,
      weightKg: record.pet_weight_snapshot as number,
    }));

  if (history.length) return history;
  if (!fallback || !fallback.measuredAt || !Number.isFinite(fallback.weightKg) || fallback.weightKg <= 0) return [];
  return [fallback];
}
