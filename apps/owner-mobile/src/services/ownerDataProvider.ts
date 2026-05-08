import type { OwnerBootstrapDto } from "@/types/bootstrap";
import type {
  AppointmentDetailViewModel,
  AppointmentRowViewModel,
  CustomerDetailViewModel,
  CustomerSummaryViewModel,
  SettingsSummaryViewModel,
  ShopSummaryViewModel,
  TodayHomeViewModel,
} from "@/viewModels/ownerViewModels";

export type OwnerDataProvider = {
  getBootstrap(): OwnerBootstrapDto;
  getShopSummary(): ShopSummaryViewModel;
  getAppointmentRows(date?: string): AppointmentRowViewModel[];
  getTodayHome(today?: string): TodayHomeViewModel;
  getAppointmentDetail(appointmentId: string): AppointmentDetailViewModel | null;
  getCustomerSummaries(): CustomerSummaryViewModel[];
  getCustomerDetail(guardianId: string): CustomerDetailViewModel | null;
  getSettingsSummary(): SettingsSummaryViewModel;
};
