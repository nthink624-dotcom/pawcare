export const WEEKLY_SCHEDULE_VISIBLE_DAYS = 5;

function parseScheduleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

function formatScheduleDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getRollingScheduleDates(
  referenceDate: string,
  dayCount = WEEKLY_SCHEDULE_VISIBLE_DAYS,
) {
  const start = parseScheduleDate(referenceDate);
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return formatScheduleDateKey(date);
  });
}
