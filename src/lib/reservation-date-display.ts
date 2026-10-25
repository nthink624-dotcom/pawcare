const KOREA_TIME_ZONE = "Asia/Seoul";

function addCalendarDays(value: string, days: number) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function getReservationDateDisplay(date: string, today: string) {
  const dateValue = new Date(`${date}T12:00:00+09:00`);
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    timeZone: KOREA_TIME_ZONE,
  }).format(dateValue);
  const weekdayLabel = new Intl.DateTimeFormat("ko-KR", {
    weekday: "narrow",
    timeZone: KOREA_TIME_ZONE,
  }).format(dateValue);

  if (date === today) return { dateLabel, weekdayLabel: null, relativeDateLabel: "오늘" };
  if (date === addCalendarDays(today, 1)) return { dateLabel, weekdayLabel: null, relativeDateLabel: "내일" };
  return { dateLabel, weekdayLabel, relativeDateLabel: null };
}
