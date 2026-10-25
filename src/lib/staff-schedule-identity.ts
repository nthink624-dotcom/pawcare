export type StaffScheduleIdentityTone = {
  color: string;
  background: string;
  bookingBackground: string;
  bookingBorder: string;
};

export const STAFF_SCHEDULE_IDENTITY_PALETTE: readonly StaffScheduleIdentityTone[] = [
  { color: "#1F5F69", background: "#E0F1F1", bookingBackground: "#F1FAFA", bookingBorder: "#C5DEE0" },
  { color: "#278D7F", background: "#E3F5F0", bookingBackground: "#F1FBF8", bookingBorder: "#C6E2DC" },
  { color: "#199A98", background: "#DDF7F3", bookingBackground: "#F0FCFA", bookingBorder: "#BFE5E0" },
  { color: "#4E9A68", background: "#EAF7ED", bookingBackground: "#F3FCF5", bookingBorder: "#CDE3D2" },
  { color: "#9A7D43", background: "#FBF6E8", bookingBackground: "#FEFCF4", bookingBorder: "#E8DDC5" },
  { color: "#AD7D08", background: "#FFF8D9", bookingBackground: "#FFFBE7", bookingBorder: "#E8D6A8" },
  { color: "#C46219", background: "#FFF0E4", bookingBackground: "#FFF6EC", bookingBorder: "#EBCFBA" },
  { color: "#B85B24", background: "#FDF0E7", bookingBackground: "#FFF3E9", bookingBorder: "#E7CEBC" },
  { color: "#B94A45", background: "#FFF0EF", bookingBackground: "#FFF4F2", bookingBorder: "#EBCFCC" },
  { color: "#953E3B", background: "#FBEDEC", bookingBackground: "#FDF1EF", bookingBorder: "#E7CBC8" },
] as const;

const STAFF_SCHEDULE_DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
type StaffScheduleDayKey = (typeof STAFF_SCHEDULE_DAY_KEYS)[number];
type StaffScheduleOverrideStatus = "work" | "off" | "annual" | "half";

export type StaffScheduleAvailability = {
  isWorking: boolean;
  source: "shop_closed" | "exact_override" | "default_days";
};

function getStaffScheduleDayKey(date: string): StaffScheduleDayKey {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1)).getUTCDay();
  return STAFF_SCHEDULE_DAY_KEYS[weekday];
}

export function getStaffScheduleAvailability({
  date,
  defaultDays,
  overrideStatus,
  isShopClosed,
}: {
  date: string;
  defaultDays?: StaffScheduleDayKey[];
  overrideStatus?: StaffScheduleOverrideStatus | null;
  isShopClosed: boolean;
}): StaffScheduleAvailability {
  if (isShopClosed) return { isWorking: false, source: "shop_closed" };
  if (overrideStatus) {
    return {
      isWorking: overrideStatus === "work" || overrideStatus === "half",
      source: "exact_override",
    };
  }
  // Production bootstrap always normalizes this field. Keep older local payloads visible
  // when the field itself is absent, while an explicit empty array remains an off schedule.
  if (!defaultDays) return { isWorking: true, source: "default_days" };
  const normalizedDefaultDays = new Set(defaultDays.filter((day): day is StaffScheduleDayKey => STAFF_SCHEDULE_DAY_KEYS.includes(day)));
  return {
    isWorking: normalizedDefaultDays.has(getStaffScheduleDayKey(date)),
    source: "default_days",
  };
}

export function shouldRenderStaffScheduleLane(availability: StaffScheduleAvailability, appointmentCount: number) {
  return availability.isWorking || appointmentCount > 0;
}

function hashStaffId(staffId: string) {
  let hash = 0;
  for (let index = 0; index < staffId.length; index += 1) {
    hash = (hash * 31 + staffId.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getStaffScheduleIdentityTone(staffId: string, persistedIndex?: number | null) {
  const hasValidPersistedIndex =
    typeof persistedIndex === "number" &&
    Number.isInteger(persistedIndex) &&
    persistedIndex >= 0 &&
    persistedIndex < STAFF_SCHEDULE_IDENTITY_PALETTE.length;
  const paletteIndex = hasValidPersistedIndex
    ? persistedIndex
    : hashStaffId(staffId) % STAFF_SCHEDULE_IDENTITY_PALETTE.length;
  return STAFF_SCHEDULE_IDENTITY_PALETTE[paletteIndex];
}
