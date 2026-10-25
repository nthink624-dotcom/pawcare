export type MobileGroomingStartTiming = "early" | "normal" | "late";

/**
 * Classifies a start attempt in the shop's Korea time zone.
 * The normal window includes both endpoints: -20 through +20 minutes.
 */
export function getMobileGroomingStartTiming({
  appointmentDate,
  appointmentTime,
  today,
  currentMinutes,
}: {
  appointmentDate: string;
  appointmentTime: string;
  today: string;
  currentMinutes: number;
}): MobileGroomingStartTiming {
  if (appointmentDate > today) return "early";
  if (appointmentDate < today) return "late";

  const [hour = "0", minute = "0"] = appointmentTime.split(":");
  const appointmentMinutes = Number(hour) * 60 + Number(minute);
  const difference = currentMinutes - appointmentMinutes;

  if (difference < -20) return "early";
  if (difference <= 20) return "normal";
  return "late";
}
