import { readOwnerStartupInvalidationStamp, readOwnerStartupSnapshot, type OwnerStartupSnapshot } from "./owner-startup-store";
import { getOwnerStartupRevision } from "./owner-startup-write-fence";

type ScopeHint = { principalId: string | null; shopId: string | null };
export type OwnerStartupPreparedRead<T> = () => Promise<OwnerStartupSnapshot<T> | null> | null;

/** Start optional disk/crypto work while the client route hydrates. Never grants access. */
export function prepareOwnerStartupRead<T>(readScope: () => ScopeHint): OwnerStartupPreparedRead<T> | undefined {
  if (typeof window === "undefined" || typeof WeakRef === "undefined") return undefined;
  let scope: ScopeHint;
  try { scope = readScope(); } catch { return undefined; }
  if (!scope.principalId || !scope.shopId) return undefined;
  const lookup = { principalId: scope.principalId, shopId: scope.shopId };
  const stamp = readOwnerStartupInvalidationStamp();
  if (!stamp) return undefined;
  const revision = getOwnerStartupRevision();
  performance.mark("petmanager:owner-startup:prepared-read");
  // Route modules outlive login sessions. Never make this optimization a strong
  // owner of decrypted rows, even when hydration never consumes its result.
  let pending: Promise<WeakRef<OwnerStartupSnapshot<T>> | null> | null = readOwnerStartupSnapshot<T>(lookup)
    .then(snapshot => snapshot ? new WeakRef(snapshot) : null).catch(() => null);
  const scopeStillCurrent = () => {
    try {
      const current = readScope();
      return current.principalId === scope.principalId && current.shopId === scope.shopId &&
        readOwnerStartupInvalidationStamp() === stamp && getOwnerStartupRevision() === revision;
    } catch { return false; }
  };
  return () => {
    const reading = pending;
    pending = null;
    if (!reading) return null;
    return reading.then(async reference => {
      if (!reference || !scopeStillCurrent()) return null;
      const snapshot = reference.deref() ?? await readOwnerStartupSnapshot<T>(lookup).catch(() => null);
      return snapshot && snapshot.expiresAt > Date.now() && scopeStillCurrent() ? snapshot : null;
    });
  };
}
