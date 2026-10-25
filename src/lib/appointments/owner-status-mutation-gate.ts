export type OwnerStatusMutationResult<T> =
  | { accepted: true; value: T }
  | { accepted: false };

export function createOwnerStatusMutationGate() {
  let inFlight = false;

  return {
    async run<T>(work: () => Promise<T>): Promise<OwnerStatusMutationResult<T>> {
      if (inFlight) return { accepted: false };
      inFlight = true;
      try {
        return { accepted: true, value: await work() };
      } finally {
        inFlight = false;
      }
    },
  };
}
