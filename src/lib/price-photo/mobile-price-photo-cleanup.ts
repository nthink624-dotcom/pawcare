export type TransientCleanupRegistry = {
  acquire(reference: string): void;
  cleanup(reference: string): Promise<void>;
  retryPending(): Promise<void>;
};

export function createTransientCleanupRegistry(
  remove: (reference: string) => Promise<void>,
): TransientCleanupRegistry {
  const pending = new Set<string>();
  const cleaned = new Set<string>();
  const inFlight = new Map<string, Promise<void>>();

  const acquire = (reference: string) => {
    if (!cleaned.has(reference)) pending.add(reference);
  };

  const cleanup = (reference: string) => {
    if (cleaned.has(reference)) return Promise.resolve();
    acquire(reference);
    const current = inFlight.get(reference);
    if (current) return current;

    const operation = remove(reference)
      .then(() => {
        cleaned.add(reference);
        pending.delete(reference);
      })
      .finally(() => {
        inFlight.delete(reference);
      });
    inFlight.set(reference, operation);
    return operation;
  };

  const retryPending = async () => {
    for (const reference of [...pending]) await cleanup(reference);
  };

  return { acquire, cleanup, retryPending };
}
