export const bookingCloseGraceMinuteOptions = [0, 15, 30, 60] as const;
export type BookingCloseGraceMinutes = (typeof bookingCloseGraceMinuteOptions)[number];

export function normalizeBookingCloseGraceMinutes(value: unknown): BookingCloseGraceMinutes {
  return bookingCloseGraceMinuteOptions.includes(value as BookingCloseGraceMinutes)
    ? (value as BookingCloseGraceMinutes)
    : 0;
}

type CanonicalBookingWindow = {
  startMinute: number;
  durationMinutes: number;
  bookingStartMinute: number;
  bookingEndMinute: number;
  businessOpenMinute: number;
  businessCloseMinute: number;
  closeGraceMinutes?: unknown;
  staffStartMinute?: number;
  staffEndMinute?: number;
};

export function getLatestBookingEndMinute(params: Pick<CanonicalBookingWindow, "businessCloseMinute" | "closeGraceMinutes" | "staffEndMinute">) {
  const graceMinutes = normalizeBookingCloseGraceMinutes(params.closeGraceMinutes);
  if (params.staffEndMinute === undefined) return params.businessCloseMinute + graceMinutes;
  if (params.staffEndMinute === params.businessCloseMinute) return params.businessCloseMinute + graceMinutes;
  return Math.min(params.staffEndMinute, params.businessCloseMinute);
}

export function getLatestBookingStartMinute(
  params: Pick<
    CanonicalBookingWindow,
    "bookingEndMinute" | "businessCloseMinute" | "durationMinutes" | "closeGraceMinutes" | "staffEndMinute"
  >,
) {
  if (
    !Number.isFinite(params.bookingEndMinute) ||
    !Number.isFinite(params.businessCloseMinute) ||
    !Number.isInteger(params.durationMinutes) ||
    params.durationMinutes <= 0
  ) return null;

  return Math.min(
    params.bookingEndMinute,
    getLatestBookingEndMinute(params) - params.durationMinutes,
  );
}

export function isBookingWithinCanonicalWindow(params: CanonicalBookingWindow) {
  if (
    getLatestBookingStartMinute(params) === null ||
    !Number.isFinite(params.startMinute)
  ) return false;

  const earliestStartMinute = Math.max(
    params.bookingStartMinute,
    params.businessOpenMinute,
    params.staffStartMinute ?? Number.NEGATIVE_INFINITY,
  );
  const latestEndMinute = getLatestBookingEndMinute(params);
  return (
    params.startMinute >= earliestStartMinute &&
    params.startMinute <= params.bookingEndMinute &&
    params.startMinute + params.durationMinutes <= latestEndMinute
  );
}
