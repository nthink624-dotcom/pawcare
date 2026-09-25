export const defaultConcurrentCapacity = 1;

export function normalizeConcurrentCapacity(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : defaultConcurrentCapacity;
  return Math.min(2, Math.max(defaultConcurrentCapacity, numeric));
}
