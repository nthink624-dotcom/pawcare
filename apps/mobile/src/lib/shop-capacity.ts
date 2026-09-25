export const defaultConcurrentCapacity = 2;

export function normalizeConcurrentCapacity(value: number | null | undefined) {
  const numeric = typeof value === "number" && Number.isFinite(value) ? value : defaultConcurrentCapacity;
  return Math.max(defaultConcurrentCapacity, numeric);
}
