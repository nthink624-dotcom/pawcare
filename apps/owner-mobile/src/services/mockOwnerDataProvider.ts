import { ownerBootstrapMock } from "@/screens/ownerPlaceholderData";
import type { OwnerDataProvider } from "@/services/ownerDataProvider";
import type { OwnerBootstrapDto } from "@/types/bootstrap";
import {
  buildAppointmentDetailViewModel,
  buildAppointmentRows,
  buildCustomerDetailViewModel,
  buildCustomerSummaries,
  buildSettingsSummaryViewModel,
  buildTodayHomeViewModel,
} from "@/viewModels/ownerViewModels";

export const DEFAULT_OWNER_PROVIDER_TODAY = "2026-05-08";

export function createMockOwnerDataProvider(
  bootstrap: OwnerBootstrapDto = ownerBootstrapMock,
  defaultToday = DEFAULT_OWNER_PROVIDER_TODAY,
): OwnerDataProvider {
  return {
    getBootstrap: () => bootstrap,
    getShopSummary: () => buildSettingsSummaryViewModel(bootstrap).shop,
    getAppointmentRows: (date = defaultToday) => buildAppointmentRows(bootstrap, date),
    getTodayHome: (today = defaultToday) => buildTodayHomeViewModel(bootstrap, today),
    getAppointmentDetail: (appointmentId) => buildAppointmentDetailViewModel(bootstrap, appointmentId),
    getCustomerSummaries: () => buildCustomerSummaries(bootstrap),
    getCustomerDetail: (guardianId) => buildCustomerDetailViewModel(bootstrap, guardianId),
    getSettingsSummary: () => buildSettingsSummaryViewModel(bootstrap),
  };
}
