import { useCallback, useEffect, useMemo, useState } from "react";

import type { OwnerSessionTokenResolver } from "@/services/authSessionProvider";
import { emptyManualAccessTokenResolver, type ManualAccessTokenResolver } from "@/services/manualAccessToken";
import { getOwnerApiConfig, type OwnerApiConfig } from "@/services/ownerApiConfig";
import { selectOwnerDataProvider, type SelectOwnerDataProviderOptions, type SelectOwnerDataProviderResult } from "@/services/selectOwnerDataProvider";
import type { SettingsSummaryViewModel } from "@/viewModels/ownerViewModels";

export type SettingsSummaryPreviewStatus = "mock" | "loading" | "ready" | "error";

export type SettingsSummaryPreviewSource = "mock" | "real";

export type SettingsSummaryPreviewState = {
  status: SettingsSummaryPreviewStatus;
  source: SettingsSummaryPreviewSource;
  viewModel: SettingsSummaryViewModel;
  error: Error | null;
};

export type UseSettingsSummaryPreviewOptions = {
  mockSummary: SettingsSummaryViewModel;
  autoLoad?: boolean;
  accessTokenResolver?: ManualAccessTokenResolver;
  sessionTokenResolver?: OwnerSessionTokenResolver;
  ownerEmail?: string | null;
  shopId?: string;
  today?: string;
  apiConfig?: OwnerApiConfig;
  selectProvider?: (options: SelectOwnerDataProviderOptions) => Promise<SelectOwnerDataProviderResult>;
};

export type LoadSettingsSummaryPreviewOptions = Omit<UseSettingsSummaryPreviewOptions, "autoLoad"> & {
  apiConfig: OwnerApiConfig;
};

export type UseSettingsSummaryPreviewResult = SettingsSummaryPreviewState & {
  loading: boolean;
  retry: () => void;
};

export async function loadSettingsSummaryPreview({
  mockSummary,
  accessTokenResolver = emptyManualAccessTokenResolver,
  sessionTokenResolver,
  ownerEmail,
  shopId,
  today,
  apiConfig,
  selectProvider = selectOwnerDataProvider,
}: LoadSettingsSummaryPreviewOptions): Promise<SettingsSummaryPreviewState> {
  if (apiConfig.dataProvider !== "real") {
    return {
      status: "mock",
      source: "mock",
      viewModel: mockSummary,
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
      viewModel: result.provider.getSettingsSummary(),
      error: null,
    };
  } catch (error: unknown) {
    return {
      status: "error",
      source: "mock",
      viewModel: mockSummary,
      error: error instanceof Error ? error : new Error("Failed to load settings summary preview."),
    };
  }
}

export function useSettingsSummaryPreview({
  mockSummary,
  autoLoad = true,
  accessTokenResolver = emptyManualAccessTokenResolver,
  sessionTokenResolver,
  ownerEmail,
  shopId,
  today,
  apiConfig: providedApiConfig,
  selectProvider = selectOwnerDataProvider,
}: UseSettingsSummaryPreviewOptions): UseSettingsSummaryPreviewResult {
  const apiConfig = useMemo(() => providedApiConfig ?? getOwnerApiConfig(), [providedApiConfig]);
  const [state, setState] = useState<SettingsSummaryPreviewState>(() => ({
    status: apiConfig.dataProvider === "real" ? "loading" : "mock",
    source: "mock",
    viewModel: mockSummary,
    error: null,
  }));

  const load = useCallback(() => {
    if (apiConfig.dataProvider !== "real") {
      setState({
        status: "mock",
        source: "mock",
        viewModel: mockSummary,
        error: null,
      });
      return;
    }

    let active = true;
    setState({
      status: "loading",
      source: "mock",
      viewModel: mockSummary,
      error: null,
    });

    loadSettingsSummaryPreview({
      mockSummary,
      accessTokenResolver,
      sessionTokenResolver,
      ownerEmail,
      shopId,
      today,
      apiConfig,
      selectProvider,
    })
      .then((nextState) => {
        if (!active) return;

        setState(nextState);
      });

    return () => {
      active = false;
    };
  }, [accessTokenResolver, apiConfig, mockSummary, ownerEmail, selectProvider, sessionTokenResolver, shopId, today]);

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
