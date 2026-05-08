import { useCallback, useEffect, useMemo, useState } from "react";

import { createMockOwnerDataProvider } from "@/services/mockOwnerDataProvider";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { runOwnerDataProviderLoad } from "@/services/ownerDataLoader";
import { initialOwnerDataState, type OwnerDataState } from "@/services/ownerDataState";

export type UseOwnerDataProviderOptions = {
  autoLoad?: boolean;
  loadProvider?: () => OwnerDataProvider | Promise<OwnerDataProvider>;
};

export type UseOwnerDataProviderResult = {
  state: OwnerDataState;
  provider: OwnerDataProvider | null;
  loading: boolean;
  error: Error | null;
  retry: () => void;
};

export function useOwnerDataProvider(options: UseOwnerDataProviderOptions = {}): UseOwnerDataProviderResult {
  const { autoLoad = true, loadProvider } = options;
  const [state, setState] = useState<OwnerDataState>(initialOwnerDataState);

  const resolveProvider = useMemo(() => loadProvider ?? (() => createMockOwnerDataProvider()), [loadProvider]);

  const load = useCallback(() => {
    return runOwnerDataProviderLoad({
      loadProvider: resolveProvider,
      onState: setState,
    });
  }, [resolveProvider]);

  useEffect(() => {
    if (!autoLoad) return;

    return load();
  }, [autoLoad, load]);

  return {
    state,
    provider: state.provider,
    loading: state.status === "loading",
    error: state.error,
    retry: load,
  };
}
