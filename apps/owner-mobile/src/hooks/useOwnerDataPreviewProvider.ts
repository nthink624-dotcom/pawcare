import { useCallback, useEffect, useMemo, useState } from "react";

import type { OwnerSessionTokenResolver } from "@/services/authSessionProvider";
import { emptyManualAccessTokenResolver, type ManualAccessTokenResolver } from "@/services/manualAccessToken";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { getOwnerApiConfig, type OwnerApiConfig } from "@/services/ownerApiConfig";
import {
  selectOwnerDataProvider,
  type SelectOwnerDataProviderOptions,
  type SelectOwnerDataProviderResult,
} from "@/services/selectOwnerDataProvider";

export type OwnerDataPreviewProviderStatus = "mock" | "loading" | "ready" | "error";

export type OwnerDataPreviewProviderSource = "mock" | "real";

export type OwnerDataPreviewProviderState = {
  status: OwnerDataPreviewProviderStatus;
  source: OwnerDataPreviewProviderSource;
  provider: OwnerDataProvider;
  error: Error | null;
};

export type UseOwnerDataPreviewProviderOptions = {
  mockProvider: OwnerDataProvider;
  autoLoad?: boolean;
  accessTokenResolver?: ManualAccessTokenResolver;
  sessionTokenResolver?: OwnerSessionTokenResolver;
  ownerEmail?: string | null;
  shopId?: string;
  today?: string;
  apiConfig?: OwnerApiConfig;
  selectProvider?: (options: SelectOwnerDataProviderOptions) => Promise<SelectOwnerDataProviderResult>;
};

export type LoadOwnerDataPreviewProviderOptions = Omit<UseOwnerDataPreviewProviderOptions, "autoLoad"> & {
  apiConfig: OwnerApiConfig;
};

export type UseOwnerDataPreviewProviderResult = OwnerDataPreviewProviderState & {
  loading: boolean;
  retry: () => void;
};

export async function loadOwnerDataPreviewProvider({
  mockProvider,
  accessTokenResolver = emptyManualAccessTokenResolver,
  sessionTokenResolver,
  ownerEmail,
  shopId,
  today,
  apiConfig,
  selectProvider = selectOwnerDataProvider,
}: LoadOwnerDataPreviewProviderOptions): Promise<OwnerDataPreviewProviderState> {
  if (apiConfig.dataProvider !== "real") {
    return {
      status: "mock",
      source: "mock",
      provider: mockProvider,
      error: null,
    };
  }

  try {
    const sessionToken = sessionTokenResolver ? await sessionTokenResolver() : null;
    const resolvedAccessTokenResolver: ManualAccessTokenResolver = sessionTokenResolver
      ? () => sessionToken?.accessToken
      : accessTokenResolver;
    const resolvedOwnerEmail = ownerEmail ?? sessionToken?.ownerEmail ?? null;
    const result = await selectProvider({
      apiConfig,
      accessTokenResolver: resolvedAccessTokenResolver,
      ownerEmail: resolvedOwnerEmail,
      shopId,
      today,
    });

    return {
      status: "ready",
      source: "real",
      provider: result.provider,
      error: null,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      source: "mock",
      provider: mockProvider,
      error: error instanceof Error ? error : new Error("Failed to load owner data preview provider."),
    };
  }
}

export function useOwnerDataPreviewProvider({
  mockProvider,
  autoLoad = true,
  accessTokenResolver = emptyManualAccessTokenResolver,
  sessionTokenResolver,
  ownerEmail,
  shopId,
  today,
  apiConfig: providedApiConfig,
  selectProvider = selectOwnerDataProvider,
}: UseOwnerDataPreviewProviderOptions): UseOwnerDataPreviewProviderResult {
  const apiConfig = useMemo(() => providedApiConfig ?? getOwnerApiConfig(), [providedApiConfig]);
  const [state, setState] = useState<OwnerDataPreviewProviderState>(() => ({
    status: apiConfig.dataProvider === "real" ? "loading" : "mock",
    source: "mock",
    provider: mockProvider,
    error: null,
  }));

  const load = useCallback(() => {
    if (apiConfig.dataProvider !== "real") {
      setState({
        status: "mock",
        source: "mock",
        provider: mockProvider,
        error: null,
      });
      return;
    }

    let active = true;
    setState({
      status: "loading",
      source: "mock",
      provider: mockProvider,
      error: null,
    });

    loadOwnerDataPreviewProvider({
      mockProvider,
      accessTokenResolver,
      sessionTokenResolver,
      ownerEmail,
      shopId,
      today,
      apiConfig,
      selectProvider,
    }).then((nextState) => {
      if (!active) return;

      setState(nextState);
    });

    return () => {
      active = false;
    };
  }, [accessTokenResolver, apiConfig, mockProvider, ownerEmail, selectProvider, sessionTokenResolver, shopId, today]);

  useEffect(() => {
    if (!autoLoad) return;

    return load();
  }, [autoLoad, load]);

  return {
    ...state,
    loading: state.status === "loading",
    retry: load,
  };
}
