import type { AppointmentSource, AppointmentStatus } from "@/types/bootstrap";

export type AppointmentStatusSection = "pending" | "active" | "completed" | "cancelChange";

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  pending: "승인 대기",
  confirmed: "확정",
  in_progress: "진행 중",
  almost_done: "픽업 준비",
  completed: "완료",
  cancelled: "취소",
  rejected: "거절",
  noshow: "노쇼",
};

const STATUS_SECTIONS: Record<AppointmentStatus, AppointmentStatusSection> = {
  pending: "pending",
  confirmed: "active",
  in_progress: "active",
  almost_done: "active",
  completed: "completed",
  cancelled: "cancelChange",
  rejected: "cancelChange",
  noshow: "cancelChange",
};

const SOURCE_LABELS: Record<AppointmentSource, string> = {
  owner: "오너 직접 등록",
  customer: "고객 예약 링크",
};

export function getAppointmentStatusLabel(status: AppointmentStatus) {
  return STATUS_LABELS[status];
}

export function getAppointmentStatusSection(status: AppointmentStatus) {
  return STATUS_SECTIONS[status];
}

export function getAppointmentSourceLabel(source: AppointmentSource) {
  return SOURCE_LABELS[source];
}

export function isActiveAppointmentStatus(status: AppointmentStatus) {
  return getAppointmentStatusSection(status) === "active";
}
