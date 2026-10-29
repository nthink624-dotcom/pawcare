import type { BootstrapQueryBundle } from "@/server/bootstrap-query-bundle";

export async function expireBootstrapDeposits(
  snapshot: Promise<BootstrapQueryBundle | null> | null,
  expire: () => Promise<number>,
): Promise<number> {
  if (!snapshot) return expire();
  const current = await snapshot;
  // This absence comes from the same fresh database snapshot as the returned
  // appointments. Any pending hold, including a future one, keeps expiry checks.
  if (current?.pendingDepositPreparationExists === false) return 0;
  return expire();
}
