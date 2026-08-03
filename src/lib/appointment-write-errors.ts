type AppointmentWriteError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const STAFF_OVERLAP_ERROR = "appointment overlaps another active appointment for the same staff member";

export function getAppointmentWriteErrorMessage(
  error: AppointmentWriteError,
  fallback = "예약을 저장하지 못했습니다.",
) {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  if (detail.includes(STAFF_OVERLAP_ERROR)) {
    return "선택한 담당자에게 같은 시간 예약이 있습니다.";
  }

  return error.message?.trim() || fallback;
}
