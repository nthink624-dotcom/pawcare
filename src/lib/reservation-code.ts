export function formatReservationCode(appointmentId: string) {
  const compact = appointmentId.replace(/-/g, "").slice(-6).toUpperCase();
  return `MM-${compact}`;
}

export function normalizeReservationCode(value: string) {
  return value.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
