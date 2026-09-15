export function createOwnerMobileBackgroundRefreshGate(
  minIntervalMs: number,
  now: () => number = Date.now,
) {
  let nextAllowedAt = 0;

  return {
    shouldRun() {
      const currentTime = now();
      if (currentTime < nextAllowedAt) return false;
      nextAllowedAt = currentTime + minIntervalMs;
      return true;
    },
  };
}
