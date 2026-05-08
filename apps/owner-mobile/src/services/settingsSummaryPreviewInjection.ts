import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import type { SelectOwnerDataProviderResult } from "@/services/selectOwnerDataProvider";
import type { SettingsSummaryViewModel } from "@/viewModels/ownerViewModels";

export const SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV = "EXPO_PUBLIC_OWNER_SETTINGS_SUMMARY_PREVIEW";
export const SETTINGS_SUMMARY_PREVIEW_INJECTED_READY = "injected-ready";
export const INJECTED_SETTINGS_ACCOUNT_EMAIL = "settings-preview@example.test";

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

export function isSettingsSummaryPreviewInjectionEnabled() {
  return typeof process !== "undefined"
    ? process.env?.[SETTINGS_SUMMARY_PREVIEW_INJECTION_ENV]?.trim() === SETTINGS_SUMMARY_PREVIEW_INJECTED_READY
    : false;
}

export function createInjectedSettingsSummaryPreviewSelectProvider(
  mockSummary: SettingsSummaryViewModel,
): (() => Promise<SelectOwnerDataProviderResult>) | undefined {
  if (!isSettingsSummaryPreviewInjectionEnabled()) return undefined;

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
