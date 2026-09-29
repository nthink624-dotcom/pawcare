export const MIN_DURATION_SAMPLE_SIZE = 3;
export const MAX_VALID_DURATION_MINUTES = 24 * 60;

export type DurationStats = {
  sampleCount: number;
  averageMinutes: number | null;
  medianMinutes: number | null;
  recommendedMinutes: number | null;
  minimumMinutes: number | null;
  maximumMinutes: number | null;
};

export function positiveDurationMinutes(value: unknown) {
  const minutes = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0 || minutes > MAX_VALID_DURATION_MINUTES) return null;
  return Math.round(minutes);
}

function median(values: number[]) {
  if (values.length === 0) return null;
  const middle = Math.floor(values.length / 2);
  return values.length % 2 === 0
    ? (values[middle - 1] + values[middle]) / 2
    : values[middle];
}

function roundToFive(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.max(5, Math.round(value / 5) * 5);
}

export function summarizeDurationMinutes(values: unknown[]): DurationStats {
  const normalized = values
    .map(positiveDurationMinutes)
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);
  const total = normalized.reduce((sum, value) => sum + value, 0);
  const averageMinutes = normalized.length > 0 ? Math.round(total / normalized.length) : null;
  const medianMinutes = median(normalized);

  return {
    sampleCount: normalized.length,
    averageMinutes,
    medianMinutes: medianMinutes === null ? null : Math.round(medianMinutes),
    recommendedMinutes:
      normalized.length >= MIN_DURATION_SAMPLE_SIZE ? roundToFive(medianMinutes) : null,
    minimumMinutes: normalized[0] ?? null,
    maximumMinutes: normalized[normalized.length - 1] ?? null,
  };
}

export const EMPTY_DURATION_STATS: DurationStats = {
  sampleCount: 0,
  averageMinutes: null,
  medianMinutes: null,
  recommendedMinutes: null,
  minimumMinutes: null,
  maximumMinutes: null,
};

export function hasEnoughDurationSamples(stats: DurationStats | null | undefined) {
  return Boolean(stats && stats.sampleCount >= MIN_DURATION_SAMPLE_SIZE && stats.recommendedMinutes);
}

export type DurationEstimate = {
  minutes: number | null;
  source: "pet" | "service_weight" | "service" | "shop" | "baseline";
  stats: DurationStats | null;
};

export function resolveDurationEstimate({
  baselineMinutes,
  petStats,
  serviceWeightStats,
  serviceStats,
  shopStats,
}: {
  baselineMinutes: number | null;
  petStats?: DurationStats | null;
  serviceWeightStats?: DurationStats | null;
  serviceStats?: DurationStats | null;
  shopStats?: DurationStats | null;
}): DurationEstimate {
  const candidates: Array<[DurationEstimate["source"], DurationStats | null | undefined]> = [
    ["pet", petStats],
    ["service_weight", serviceWeightStats],
    ["service", serviceStats],
    ["shop", shopStats],
  ];
  const selected = candidates.find(([, stats]) => hasEnoughDurationSamples(stats));
  if (selected) {
    return {
      minutes: selected[1]?.recommendedMinutes ?? baselineMinutes,
      source: selected[0],
      stats: selected[1] ?? null,
    };
  }
  return { minutes: baselineMinutes, source: "baseline", stats: null };
}
