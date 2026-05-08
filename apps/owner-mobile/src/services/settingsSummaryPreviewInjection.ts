import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import {
  createRealOwnerDataProvider,
  loadRealOwnerBootstrap,
  type OwnerApiFetch,
  type OwnedShopSummaryDto,
} from "@/services/realOwnerDataProvider";
import type { SelectOwnerDataProviderOptions, SelectOwnerDataProviderResult } from "@/services/selectOwnerDataProvider";
import { ownerBootstrapMock } from "@/screens/ownerPlaceholderData";
import type { SettingsSummaryViewModel } from "@/viewModels/ownerViewModels";

export const SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV = "EXPO_PUBLIC_OWNER_SETTINGS_SUMMARY_PREVIEW";
export const SETTINGS_SUMMARY_PREVIEW_INJECTED_READY = "injected-ready";
export const SETTINGS_SUMMARY_PREVIEW_MOCK_FETCH_READY = "mock-fetch-ready";
export const INJECTED_SETTINGS_ACCOUNT_EMAIL = "settings-preview@example.test";
export const MOCK_FETCH_SETTINGS_ACCOUNT_EMAIL = "settings-mock-fetch@example.test";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export function isSettingsSummaryPreviewInjectionEnabled() {
  return typeof process !== "undefined"
    ? [SETTINGS_SUMMARY_PREVIEW_INJECTED_READY, SETTINGS_SUMMARY_PREVIEW_MOCK_FETCH_READY].includes(
        process.env?.[SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV]?.trim() ?? "",
      )
    : false;
}

export function createInjectedSettingsSummaryPreviewSelectProvider(
  mockSummary: SettingsSummaryViewModel,
): ((options: SelectOwnerDataProviderOptions) => Promise<SelectOwnerDataProviderResult>) | undefined {
  const mode = typeof process !== "undefined" ? process.env?.[SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV]?.trim() : undefined;
  if (mode === SETTINGS_SUMMARY_PREVIEW_MOCK_FETCH_READY) {
    return createMockFetchSettingsSummaryPreview;
  }

  if (mode !== SETTINGS_SUMMARY_PREVIEW_INJECTED_READY) return undefined;

  return async () => ({
    mode: "real",
    selectedShopId: mockSummary.shop.id,
    ownedShops: [
      {
        id: mockSummary.shop.id,
        name: mockSummary.shop.name,
        address: mockSummary.shop.address,
        heroImageUrl: "",
      },
    ],
    provider: createSettingsOnlyProvider(mockSummary),
  });
}

async function createMockFetchSettingsSummaryPreview(options: SelectOwnerDataProviderOptions): Promise<SelectOwnerDataProviderResult> {
  const apiBaseUrl = "http://mock-owner-api.local";
  const selectedShopId = "mock-fetch-shop";
  const ownedShops: OwnedShopSummaryDto[] = [
    {
      id: selectedShopId,
      name: "Mock Fetch Grooming",
      address: "Mock Fetch Street 10",
      heroImageUrl: "",
    },
  ];
  const result = await loadRealOwnerBootstrap({
    apiBaseUrl,
    accessToken: "mock-fetch-access-token",
    ownerEmail: MOCK_FETCH_SETTINGS_ACCOUNT_EMAIL,
    shopId: selectedShopId,
    today: options.today,
    apiConfig: {
      dataProvider: "real",
      apiBaseUrl,
      apiStage: "development",
      allowProdApiInDev: false,
      devShopId: selectedShopId,
    },
    fetcher: createSettingsSummaryMockFetch(ownedShops, selectedShopId),
  });

  return {
    mode: "real",
    selectedShopId: result.selectedShopId,
    ownedShops: result.ownedShops,
    provider: createRealOwnerDataProvider(result.bootstrap, options.today),
  };
}

function createSettingsSummaryMockFetch(ownedShops: OwnedShopSummaryDto[], selectedShopId: string): OwnerApiFetch {
  const bootstrap = {
    ...ownerBootstrapMock,
    ownerProfile: {
      email: MOCK_FETCH_SETTINGS_ACCOUNT_EMAIL,
    },
    shop: {
      ...ownerBootstrapMock.shop,
      id: selectedShopId,
      name: "Mock Fetch Grooming",
      address: "Mock Fetch Street 10",
      phone: "02-000-0000",
    },
  };

  return async (url, init) => {
    const requestPath = url.replace(/^https?:\/\/[^/]+/, "");
    const [pathname, queryString = ""] = requestPath.split("?");

    if (init.method !== "GET") {
      throw new Error("Settings summary mock fetch only allows GET requests.");
    }

    if (pathname === "/api/owner/shops") {
      return jsonResponse(ownedShops);
    }

    if (pathname === "/api/bootstrap" && queryString.split("&").includes(`shopId=${encodeURIComponent(selectedShopId)}`)) {
      return jsonResponse(bootstrap);
    }

    throw new Error(`Unexpected settings summary mock fetch path: ${pathname}`);
  };
}

function jsonResponse(value: unknown) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(value),
  };
}

function createSettingsOnlyProvider(mockSummary: SettingsSummaryViewModel): OwnerDataProvider {
  const settingsSummary = {
    ...mockSummary,
    accountEmail: INJECTED_SETTINGS_ACCOUNT_EMAIL,
    rows: mockSummary.rows.map((row) =>
      row.key === "shop"
        ? {
            ...row,
            description: "Injected read-only settings summary preview",
          }
        : row,
    ),
  };
  const blockedGetter = () => {
    throw new Error("Injected settings summary preview must not be used outside Settings.");
  };

  return {
    getBootstrap: blockedGetter,
    getShopSummary: blockedGetter,
    getAppointmentRows: blockedGetter,
    getTodayHome: blockedGetter,
    getAppointmentDetail: blockedGetter,
    getCustomerSummaries: blockedGetter,
    getCustomerDetail: blockedGetter,
    getSettingsSummary: () => settingsSummary,
  };
}
