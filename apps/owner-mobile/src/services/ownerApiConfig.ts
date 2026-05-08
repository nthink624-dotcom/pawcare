export type OwnerDataProviderMode = "mock" | "real";
export type OwnerApiStage = "development" | "preview" | "production";

export type OwnerApiConfig = {
  dataProvider: OwnerDataProviderMode;
  apiBaseUrl: string;
  apiStage: OwnerApiStage;
  allowProdApiInDev: boolean;
  devShopId?: string;
};

declare const process:
  | {
      env?: Record<string, string | undefined>;
    }
  | undefined;

const DEFAULT_OWNER_API_BASE_URL = "http://localhost:3000";

function readEnv(name: string) {
  return typeof process !== "undefined" ? process.env?.[name]?.trim() : undefined;
}

function normalizeProviderMode(value: string | undefined): OwnerDataProviderMode {
  return value === "real" ? "real" : "mock";
}

function normalizeStage(value: string | undefined): OwnerApiStage {
  if (value === "preview" || value === "production") return value;
  return "development";
}

function normalizeBaseUrl(value: string | undefined) {
  return (value || DEFAULT_OWNER_API_BASE_URL).replace(/\/+$/, "");
}

export function getOwnerApiConfig(): OwnerApiConfig {
  return {
    dataProvider: normalizeProviderMode(readEnv("EXPO_PUBLIC_OWNER_DATA_PROVIDER")),
    apiBaseUrl: normalizeBaseUrl(readEnv("EXPO_PUBLIC_OWNER_API_BASE_URL")),
    apiStage: normalizeStage(readEnv("EXPO_PUBLIC_OWNER_API_STAGE")),
    allowProdApiInDev: readEnv("EXPO_PUBLIC_ALLOW_PROD_API_IN_DEV") === "true",
    devShopId: readEnv("EXPO_PUBLIC_OWNER_DEV_SHOP_ID"),
  };
}

export function assertOwnerApiConfigIsSafe(config: OwnerApiConfig) {
  const isProductionApi = /petmanager\.co\.kr/i.test(config.apiBaseUrl);
  const isNonProductionApp = config.apiStage !== "production";

  if (isProductionApi && isNonProductionApp && !config.allowProdApiInDev) {
    throw new Error("Production owner API is blocked outside production unless explicitly allowed.");
  }
}
