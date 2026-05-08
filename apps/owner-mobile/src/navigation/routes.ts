import type { NavigatorScreenParams } from "@react-navigation/native";

export type AuthStackParamList = {
  Login: undefined;
};

export type ReservationStackParamList = {
  ReservationList: undefined;
  ReservationDetail: { reservationId: string };
};

export type CustomerStackParamList = {
  CustomerList: undefined;
  CustomerDetail: { customerId: string };
};

export type MainTabsParamList = {
  Today: undefined;
  Reservations: NavigatorScreenParams<ReservationStackParamList> | undefined;
  Customers: NavigatorScreenParams<CustomerStackParamList> | undefined;
  Settings: undefined;
};

export const TAB_LABELS: Record<keyof MainTabsParamList, string> = {
  Today: "홈",
  Reservations: "예약조회",
  Customers: "고객관리",
  Settings: "설정",
};
