import { createMockOwnerDataProvider } from "@/services/mockOwnerDataProvider";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { getOwnerApiConfig, type OwnerApiConfig } from "@/services/ownerApiConfig";
import {
  createRealOwnerDataProvider,
  loadRealOwnerBootstrap,
  type LoadRealOwnerBootstrapResult,
  type OwnedShopSummaryDto,
  type RealOwnerDataProviderConfig,
} from "@/services/realOwnerDataProvider";
import type { OwnerBootstrapDto } from "@/types/bootstrap";

export type SelectOwnerDataProviderOptions = {
  apiConfig?: OwnerApiConfig;
  accessToken?: string;
  ownerEmail?: string | null;
  shopId?: string;
  today?: string;
  mockBootstrap?: OwnerBootstrapDto;
  loadRealBootstrap?: (config: RealOwnerDataProviderConfig) => Promise<LoadRealOwnerBootstrapResult>;
};

export type SelectOwnerDataProviderResult = {
  mode: "mock" | "real";
  provider: OwnerDataProvider;
  ownedShops?: OwnedShopSummaryDto[];
  selectedShopId?: string;
};

export async function selectOwnerDataProvider(
  options: SelectOwnerDataProviderOptions = {},
): Promise<SelectOwnerDataProviderResult> {
  const apiConfig = options.apiConfig ?? getOwnerApiConfig();

  if (apiConfig.dataProvider !== "real") {
    return {
      mode: "mock",
      provider: createMockOwnerDataProvider(options.mockBootstrap, options.today),
    };
  }

  if (!apiConfig.apiBaseUrl.trim()) {
    throw new Error("Owner API base URL is required when real owner data provider is enabled.");
  }

  if (!options.accessToken) {
    throw new Error("Owner access token is required when real owner data provider is enabled.");
  }

  const loadBootstrap = options.loadRealBootstrap ?? loadRealOwnerBootstrap;
  const result = await loadBootstrap({
    apiBaseUrl: apiConfig.apiBaseUrl,
    accessToken: options.accessToken,
    shopId: options.shopId,
    ownerEmail: options.ownerEmail,
    today: options.today,
    apiConfig,
  });

  return {
    mode: "real",
    provider: createRealOwnerDataProvider(result.bootstrap, options.today),
    ownedShops: result.ownedShops,
    selectedShopId: result.selectedShopId,
  };
}
