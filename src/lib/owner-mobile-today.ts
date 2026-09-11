export type AppointmentSnapshot = {
  id: string;
};

function addUtcDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return next.toISOString().slice(0, 10);
}

/** Keeps mobile date shortcuts on calendar-day keys without device-local drift. */
export function getOwnerTodayQuickDates(todayDate: string) {
  return [
    { key: todayDate, label: "오늘" },
    { key: addUtcDays(todayDate, 1), label: "내일" },
    { key: addUtcDays(todayDate, 2), label: "모레" },
  ];
}

export function getOwnerTodayRelativeLabel(dateKey: string, todayDate: string) {
  if (dateKey === todayDate) return "오늘";
  if (dateKey === addUtcDays(todayDate, 1)) return "내일";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    weekday: "short",
  }).format(new Date(`${dateKey}T12:00:00+09:00`));
}

export function getOwnerTodaySlideDirection(currentDate: string, nextDate: string): "prev" | "next" {
  return nextDate < currentDate ? "prev" : "next";
}

/** A bootstrap response is authoritative: one appointment id renders once. */
export function dedupeAuthoritativeAppointments<T extends AppointmentSnapshot>(appointments: T[]) {
  const byId = new Map<string, T>();
  for (const appointment of appointments) {
    byId.set(appointment.id, appointment);
  }
  return Array.from(byId.values());
}

export function shouldApplyOwnerMobileRefresh(requestId: number, lastAppliedRequestId: number) {
  return requestId >= lastAppliedRequestId;
}
