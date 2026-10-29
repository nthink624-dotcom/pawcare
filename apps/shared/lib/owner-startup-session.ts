"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { BootstrapActor } from "../contracts/bootstrap-actor";
import { beginOwnerStartupReadOnly, invalidateOwnerStartupRevision } from "./owner-startup-write-fence";
import { clearOwnerStartupSnapshots, readOwnerStartupSnapshot, writeOwnerStartupSnapshot, readOwnerStartupInvalidationStamp, OWNER_STARTUP_INVALIDATION_STORAGE_KEY, type OwnerStartupSnapshot } from "./owner-startup-store";
import { prepareOwnerPublicShell } from "./owner-public-shell";

type ScopedBootstrap = {
  mode: "mock" | "supabase";
  actor?: BootstrapActor;
  shop: { id: string };
  initialSetupReadiness?: { completed: boolean };
};

/** The caller renders the same home/form tree for cached and live responses, preserving drafts. */
export function useOwnerStartupSession<T extends ScopedBootstrap>(options: {
  readPrincipalHint: () => string | null;
  readShopHint: () => string | null;
  project: (value: T) => T;
}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const confirmed = useRef(false);
  const invalidation = useRef(0);
  const [snapshot, setSnapshot] = useState<OwnerStartupSnapshot<T> | null>(null);
  const [needsFresh, setNeedsFresh] = useState(true);
  const release = useRef<(() => void) | null>(null);
  const attemptStamp = useRef<string | null>(null);
  const readScope = useCallback(() => {
    try { return { principalId: optionsRef.current.readPrincipalHint(), shopId: optionsRef.current.readShopHint() }; }
    catch { return { principalId: null, shopId: null }; }
  }, []);

  useEffect(() => {
    let active = true;
    const generation = invalidation.current;
    attemptStamp.current = readOwnerStartupInvalidationStamp();
    release.current = beginOwnerStartupReadOnly();
    const { principalId, shopId } = readScope();
    if (principalId && shopId) {
      void readOwnerStartupSnapshot<T>({ principalId, shopId }).then(cached => {
        if (!active || confirmed.current || generation !== invalidation.current || attemptStamp.current !== readOwnerStartupInvalidationStamp() || !cached ||
            readScope().principalId !== principalId || readScope().shopId !== shopId ||
            cached.data.mode !== "supabase" || cached.data.shop.id !== shopId ||
            cached.data.actor?.shopId !== shopId || cached.data.actor?.userId !== principalId) return;
        try { optionsRef.current.project(cached.data); } catch { return; }
        setSnapshot(cached);
        performance.mark("petmanager:owner-startup:local-snapshot");
      }).catch(() => { /* Cache failures must not delay the fresh canonical request. */ });
    }
    const invalidateIfChanged = (event: StorageEvent) => {
      if (event.key === OWNER_STARTUP_INVALIDATION_STORAGE_KEY) {
        invalidation.current += 1;
        invalidateOwnerStartupRevision();
        setSnapshot(null);
        return;
      }
      if (readScope().principalId === principalId && readScope().shopId === shopId) return;
      invalidation.current += 1;
      setSnapshot(null);
      // An explicit account/shop change in another tab must not leave a former tenant visible.
      window.location.reload();
    };
    window.addEventListener("storage", invalidateIfChanged);
    return () => { active = false; release.current?.(); release.current = null; window.removeEventListener("storage", invalidateIfChanged); };
  }, [readScope]);

  useLayoutEffect(() => {
    if (!needsFresh) { release.current?.(); release.current = null; }
  }, [needsFresh]);

  const acceptFresh = useCallback((value: T) => {
    confirmed.current = true;
    setSnapshot(null);
    setNeedsFresh(false);
    prepareOwnerPublicShell();
    const { principalId } = readScope();
    const shopId = value.shop.id;
    // Old APIs without a verified principal remain usable but cannot populate the cache.
    if (!principalId || value.mode !== "supabase" || value.actor?.userId !== principalId || value.actor.shopId !== shopId ||
        value.initialSetupReadiness?.completed === false || !attemptStamp.current || attemptStamp.current !== readOwnerStartupInvalidationStamp()) return;
    const generation = invalidation.current;
    const capturedAt = Date.now();
    let projection: T;
    try { projection = optionsRef.current.project(value); } catch { return; }
    void writeOwnerStartupSnapshot({ principalId, shopId }, projection, capturedAt,
      () => generation === invalidation.current && readScope().principalId === principalId && readScope().shopId === shopId,
    ).catch(() => { /* Normal operation does not depend on persistent browser storage. */ });
  }, [readScope]);

  const rejectSnapshot = useCallback(() => {
    invalidateOwnerStartupRevision();
    invalidation.current += 1;
    setSnapshot(null);
    void clearOwnerStartupSnapshots().catch(() => undefined);
  }, []);

  return { snapshot, needsFresh, acceptFresh, rejectSnapshot };
}
