import type { OwnerDataProvider } from "@/services/ownerDataProvider";

export function createRealOwnerDataProvider(): OwnerDataProvider {
  return {
    getBootstrap: notImplemented,
    getShopSummary: notImplemented,
    getAppointmentRows: notImplemented,
    getTodayHome: notImplemented,
    getAppointmentDetail: notImplemented,
    getCustomerSummaries: notImplemented,
    getCustomerDetail: notImplemented,
    getSettingsSummary: notImplemented,
  };
}

function notImplemented(): never {
  throw new Error("Real owner data provider is not implemented yet.");
}
