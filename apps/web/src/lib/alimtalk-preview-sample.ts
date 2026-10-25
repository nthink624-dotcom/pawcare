export const ALIMTALK_PREVIEW_EXAMPLE_SERVICE = "전체 미용";

export function getAlimtalkPreviewAppointmentTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const readPart = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const tomorrow = new Date(Date.UTC(readPart("year"), readPart("month") - 1, readPart("day") + 1, 12));
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "UTC",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(tomorrow);

  return `${dateLabel} 오후 2:30`;
}
