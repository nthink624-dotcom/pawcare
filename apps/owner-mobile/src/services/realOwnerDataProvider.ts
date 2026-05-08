import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import { assertOwnerApiConfigIsSafe, getOwnerApiConfig, type OwnerApiConfig } from "@/services/ownerApiConfig";
import { toOwnerBootstrapDto, type OwnerBootstrapApiPayload } from "@/services/ownerBootstrapAdapter";
import type { OwnerBootstrapDto } from "@/types/bootstrap";
import {
  buildAppointmentDetailViewModel,
  buildAppointmentRows,
  buildCustomerDetailViewModel,
  buildCustomerSummaries,
  buildSettingsSummaryViewModel,
  buildTodayHomeViewModel,
} from "@/viewModels/ownerViewModels";

export type OwnedShopSummaryDto = {
  id: string;
  name: string;
  address: string;
  heroImageUrl: string;
};

export type OwnerApiFetch = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
  },
) => Promise<{
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}>;

export type RealOwnerDataProviderConfig = {
  apiBaseUrl?: string;
  accessToken?: string;
  shopId?: string;
  ownerEmail?: string | null;
  today?: string;
  apiConfig?: OwnerApiConfig;
  fetcher?: OwnerApiFetch;
};

export type LoadRealOwnerBootstrapResult = {
  bootstrap: OwnerBootstrapDto;
  ownedShops: OwnedShopSummaryDto[];
  selectedShopId: string;
};

const DEFAULT_REAL_PROVIDER_TODAY = "2026-05-08";

export function createRealOwnerDataProvider(bootstrap: OwnerBootstrapDto, today = DEFAULT_REAL_PROVIDER_TODAY): OwnerDataProvider {
  return {
    getBootstrap: () => bootstrap,
    getShopSummary: () => buildSettingsSummaryViewModel(bootstrap).shop,
    getAppointmentRows: (date = today) => buildAppointmentRows(bootstrap, date),
    getTodayHome: (targetToday = today) => buildTodayHomeViewModel(bootstrap, targetToday),
    getAppointmentDetail: (appointmentId) => buildAppointmentDetailViewModel(bootstrap, appointmentId),
    getCustomerSummaries: () => buildCustomerSummaries(bootstrap),
    getCustomerDetail: (guardianId) => buildCustomerDetailViewModel(bootstrap, guardianId),
    getSettingsSummary: () => buildSettingsSummaryViewModel(bootstrap),
  };
}

export async function loadRealOwnerBootstrap(config: RealOwnerDataProviderConfig): Promise<LoadRealOwnerBootstrapResult> {
  const resolvedConfig = {
    ...getOwnerApiConfig(),
    ...config.apiConfig,
    apiBaseUrl: (config.apiBaseUrl || config.apiConfig?.apiBaseUrl || getOwnerApiConfig().apiBaseUrl).replace(/\/+$/, ""),
  };

  assertOwnerApiConfigIsSafe(resolvedConfig);

  if (!resolvedConfig.apiBaseUrl.trim()) {
    throw new Error("Owner API base URL is required before loading real owner data.");
  }

  if (!config.accessToken) {
    throw new Error("Owner access token is required before loading real owner data.");
  }

  const ownedShops = await getOwnedShops({
    apiBaseUrl: resolvedConfig.apiBaseUrl,
    accessToken: config.accessToken,
    fetcher: config.fetcher,
  });
  const selectedShop = resolveSelectedShop(ownedShops, config.shopId || resolvedConfig.devShopId);
  const bootstrap = await getOwnerBootstrap({
    apiBaseUrl: resolvedConfig.apiBaseUrl,
    accessToken: config.accessToken,
    shopId: selectedShop.id,
    ownerEmail: config.ownerEmail,
    fetcher: config.fetcher,
  });

  return {
    bootstrap,
    ownedShops,
    selectedShopId: selectedShop.id,
  };
}

export async function getOwnedShops(input: { apiBaseUrl: string; accessToken: string; fetcher?: OwnerApiFetch }) {
  return getJson<OwnedShopSummaryDto[]>(input, "/api/owner/shops");
}

export async function getOwnerBootstrap(input: {
  apiBaseUrl: string;
  accessToken: string;
  shopId: string;
  ownerEmail?: string | null;
  fetcher?: OwnerApiFetch;
}) {
  const query = new URLSearchParams({ shopId: input.shopId });
  const payload = await getJson<OwnerBootstrapApiPayload>(input, `/api/bootstrap?${query.toString()}`);
  return toOwnerBootstrapDto(payload, { ownerEmail: input.ownerEmail });
}

function resolveSelectedShop(ownedShops: OwnedShopSummaryDto[], requestedShopId?: string) {
  if (ownedShops.length === 0) {
    throw new Error("No owned shops were returned by the owner API.");
  }

  if (!requestedShopId) return ownedShops[0];

  const selectedShop = ownedShops.find((shop) => shop.id === requestedShopId);
  if (!selectedShop) {
    throw new Error("Requested shop is not owned by the current owner.");
  }

  return selectedShop;
}

async function getJson<T>(input: { apiBaseUrl: string; accessToken: string; fetcher?: OwnerApiFetch }, path: string): Promise<T> {
  if (!input.accessToken) {
    throw new Error("Owner access token is required before calling owner API.");
  }

  const ownerFetch = input.fetcher ?? fetch;
  const response = await ownerFetch(`${input.apiBaseUrl}${path}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json",
    },
  });
  const text = await response.text();
  const json = text ? parseJson(text) : null;

  if (!response.ok) {
    const message =
      json && typeof json === "object" && "message" in json && typeof json.message === "string"
        ? json.message
        : "Owner API request failed.";
    throw new Error(message);
  }

  return json as T;
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("Owner API returned invalid JSON.");
  }
}
