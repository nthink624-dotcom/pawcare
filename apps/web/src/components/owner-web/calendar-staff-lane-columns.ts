import type { OwnerWebStaffColumn, OwnerWebStaffMember, OwnerWebWeekdayKey } from "@/components/owner-web/owner-web-staff-data";
import type { StaffScheduleOverride } from "@/types/domain";

type LaneBooking = {
  staffKey: string;
  start: number;
  duration: number;
};

export type ScheduleStaffLaneSegment = OwnerWebStaffColumn & {
  start: number;
  end: number;
};

export type ScheduleStaffLaneColumn = {
  key: string;
  name: string;
  staffKeys: string[];
  segments: ScheduleStaffLaneSegment[];
};

const weekdayKeys: OwnerWebWeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function timeToHour(time: string | null | undefined) {
  if (!time) return null;
  const [hour = "0", minute = "0"] = time.split(":");
  const nextHour = Number(hour);
  const nextMinute = Number(minute);
  if (!Number.isFinite(nextHour) || !Number.isFinite(nextMinute)) return null;
  return nextHour + nextMinute / 60;
}

function getDateWeekdayKey(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return weekdayKeys[new Date(year, (month ?? 1) - 1, day ?? 1).getDay()];
}

function normalizeWindow(start: number | null, end: number | null) {
  if (start === null || end === null) return null;
  const nextStart = Math.max(0, Math.min(24, start));
  const nextEnd = Math.max(0, Math.min(24, end));
  if (nextEnd <= nextStart) return null;
  return { start: nextStart, end: nextEnd };
}

function getStaffWorkWindow(
  staff: OwnerWebStaffMember,
  overrides: StaffScheduleOverride[] | undefined,
  date: string,
) {
  const override = overrides?.find((item) => item.staff_id === staff.id && item.work_date === date);
  const defaultStart = timeToHour(staff.startTime);
  const defaultEnd = timeToHour(staff.endTime);

  if (override) {
    if (override.status === "off" || override.status === "annual") return null;
    if (override.status === "work") {
      return normalizeWindow(timeToHour(override.start_time) ?? defaultStart, timeToHour(override.end_time) ?? defaultEnd);
    }
    if (override.status === "half") {
      const split = timeToHour("13:00");
      if (override.period === "오전") return normalizeWindow(split, defaultEnd);
      if (override.period === "오후") return normalizeWindow(defaultStart, split);
      return normalizeWindow(defaultStart, defaultEnd);
    }
  }

  if (!staff.defaultDays.includes(getDateWeekdayKey(date))) return null;
  return normalizeWindow(defaultStart, defaultEnd);
}

function getBookingFallbackWindow(bookings: LaneBooking[], staffKey: string) {
  const staffBookings = bookings.filter((booking) => booking.staffKey === staffKey);
  if (staffBookings.length === 0) return null;

  const start = Math.min(...staffBookings.map((booking) => booking.start));
  const end = Math.max(...staffBookings.map((booking) => booking.start + booking.duration));
  return normalizeWindow(start, end);
}

function canPlaceInLane(lane: ScheduleStaffLaneSegment[], segment: Pick<ScheduleStaffLaneSegment, "start" | "end">) {
  return lane.every((item) => segment.end <= item.start || item.end <= segment.start);
}

export function buildScheduleStaffLaneColumns({
  date,
  staffColumns,
  staffMembers,
  staffScheduleOverrides,
  bookings,
}: {
  date: string;
  staffColumns: OwnerWebStaffColumn[];
  staffMembers: OwnerWebStaffMember[];
  staffScheduleOverrides?: StaffScheduleOverride[];
  bookings: LaneBooking[];
}): ScheduleStaffLaneColumn[] {
  const staffById = new Map(staffMembers.map((staff) => [staff.id, staff]));
  const segments = staffColumns
    .map((staffColumn) => {
      const staff = staffById.get(staffColumn.key);
      const workWindow = staff ? getStaffWorkWindow(staff, staffScheduleOverrides, date) : null;
      const fallbackWindow = workWindow ?? getBookingFallbackWindow(bookings, staffColumn.key);
      if (!fallbackWindow) return null;

      return {
        ...staffColumn,
        start: fallbackWindow.start,
        end: fallbackWindow.end,
      } satisfies ScheduleStaffLaneSegment;
    })
    .filter((segment): segment is ScheduleStaffLaneSegment => Boolean(segment))
    .sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));

  const lanes: ScheduleStaffLaneSegment[][] = [];
  for (const segment of segments) {
    const lane = lanes.find((candidate) => canPlaceInLane(candidate, segment));
    if (lane) {
      lane.push(segment);
    } else {
      lanes.push([segment]);
    }
  }

  return lanes.map((lane, index) => {
    const orderedSegments = [...lane].sort((a, b) => a.start - b.start || a.end - b.end);
    return {
      key: `staff-lane-${index}-${orderedSegments.map((segment) => segment.key).join("-")}`,
      name: orderedSegments.map((segment) => segment.name).join(" / "),
      staffKeys: orderedSegments.map((segment) => segment.key),
      segments: orderedSegments,
    };
  });
}

export function getScheduleLaneActiveStaff(
  lane: ScheduleStaffLaneColumn,
  start: number,
  duration: number,
) {
  const end = start + duration;
  return lane.segments.find((segment) => start >= segment.start && end <= segment.end) ?? null;
}
