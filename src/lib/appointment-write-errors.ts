type AppointmentWriteError = {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
};

const STAFF_OVERLAP_ERROR = "appointment overlaps another active appointment for the same staff member";
const GROOMING_CARE_REPORT_DATA_CONSTRAINT = "grooming_records_care_report_data_check";
const GROOMING_RECORD_ID_AMBIGUITY = 'column reference "grooming_record_id" is ambiguous';
const GROOMING_CARE_REPORT_DATA_ERROR_MESSAGE =
  "미용 완료 기록을 저장하지 못했습니다. 입력한 케어 내용은 유지되었어요. 다시 시도해 주세요.";

export function getAppointmentWriteErrorMessage(
  error: AppointmentWriteError,
  fallback = "예약을 저장하지 못했습니다.",
) {
  const detail = [error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  if (detail.includes(STAFF_OVERLAP_ERROR)) {
    return "선택한 담당자에게 같은 시간 예약이 있습니다.";
  }
  if (detail.includes(GROOMING_CARE_REPORT_DATA_CONSTRAINT) || detail.includes(GROOMING_RECORD_ID_AMBIGUITY)) {
    return GROOMING_CARE_REPORT_DATA_ERROR_MESSAGE;
  }

  return error.message?.trim() || fallback;
}
