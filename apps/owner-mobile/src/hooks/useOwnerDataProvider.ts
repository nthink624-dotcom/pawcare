import { useCallback, useEffect, useMemo, useState } from "react";

import { createMockOwnerDataProvider } from "@/services/mockOwnerDataProvider";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
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
    let active = true;

    setState({
      status: "loading",
      provider: null,
      error: null,
    });

    Promise.resolve()
      .then(resolveProvider)
      .then((provider) => {
        if (!active) return;

        setState({
          status: "ready",
          provider,
          error: null,
        });
      })
      .catch((error: unknown) => {
        if (!active) return;

        setState({
          status: "error",
          provider: null,
          error: error instanceof Error ? error : new Error("데이터를 불러오지 못했습니다."),
        });
      });

    return () => {
      active = false;
    };
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
