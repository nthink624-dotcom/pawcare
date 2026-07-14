import type { OwnerBootstrapDto } from "@/types/bootstrap";
import type { AppointmentStatus } from "@/types/bootstrap";
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
  createAppointment?(payload: Record<string, unknown>): Promise<unknown>;
  updateAppointmentStatus?(appointmentId: string, status: AppointmentStatus, payload?: Record<string, unknown>): Promise<unknown>;
  updateAppointmentDetails?(appointmentId: string, payload: Record<string, unknown>): Promise<unknown>;
  updateGuardian?(guardianId: string, payload: Record<string, unknown>): Promise<unknown>;
  deleteGuardian?(guardianId: string): Promise<unknown>;
};
