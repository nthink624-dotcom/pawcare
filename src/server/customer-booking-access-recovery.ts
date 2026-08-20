import { createHash } from "node:crypto";

import { currentDateInTimeZone, currentMinutesInTimeZone, minutesFromTime, nowIso, phoneNormalize } from "@/lib/utils";
import { deliverCustomerBookingNotificationSafely } from "@/lib/customer-booking-notification";
import { getBootstrap } from "@/server/bootstrap";
import { dispatchNotification } from "@/server/notification-dispatch";
import type { Appointment } from "@/types/domain";

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const PHONE_REQUEST_LIMIT = 3;
const IP_REQUEST_LIMIT = 10;

type RateLimitStore = Map<string, number[]>;

declare global {
  var __petmanagerCustomerAccessRateLimits: RateLimitStore | undefined;
}

function getRateLimitStore() {
  globalThis.__petmanagerCustomerAccessRateLimits ??= new Map<string, number[]>();
  return globalThis.__petmanagerCustomerAccessRateLimits;
}

function hashRateLimitValue(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function consumeRateLimit(key: string, limit: number, now = Date.now()) {
  const store = getRateLimitStore();
  const active = (store.get(key) ?? []).filter((timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS);
  if (active.length >= limit) {
    store.set(key, active);
    return false;
  }

  active.push(now);
  store.set(key, active);
  return true;
}

function canManageAppointment(appointment: Appointment) {
  if (appointment.status !== "confirmed") return false;
  const today = currentDateInTimeZone();
  if (appointment.appointment_date > today) return true;
  if (appointment.appointment_date < today) return false;
  return minutesFromTime(appointment.appointment_time) > currentMinutesInTimeZone();
}

export function checkCustomerBookingAccessRecoveryRateLimit(input: { phone: string; clientIp: string }) {
  const normalizedPhone = phoneNormalize(input.phone).slice(0, 11);
  const normalizedIp = input.clientIp.trim() || "unknown";
  const ipAllowed = consumeRateLimit(`ip:${hashRateLimitValue(normalizedIp)}`, IP_REQUEST_LIMIT);
  const phoneAllowed = consumeRateLimit(
    `phone:${hashRateLimitValue(normalizedPhone || "invalid")}`,
    PHONE_REQUEST_LIMIT,
  );
  return ipAllowed && phoneAllowed;
}

export async function requestCustomerBookingAccessLink(input: { shopId: string; phone: string }) {
  const normalizedPhone = phoneNormalize(input.phone).slice(0, 11);
  if (normalizedPhone.length < 10) return;

  const bootstrap = await getBootstrap(input.shopId, {
    includeNotifications: true,
    includeGroomingRecords: false,
    includeLanding: false,
  });
  const guardianIds = new Set(
    bootstrap.guardians
      .filter((guardian) => phoneNormalize(guardian.phone).slice(0, 11) === normalizedPhone)
      .map((guardian) => guardian.id),
  );
  if (guardianIds.size === 0) return;

  const appointment = bootstrap.appointments
    .filter((item) => guardianIds.has(item.guardian_id) && canManageAppointment(item))
    .sort((a, b) =>
      `${a.appointment_date} ${a.appointment_time}`.localeCompare(`${b.appointment_date} ${b.appointment_time}`),
    )[0];
  if (!appointment) return;

  await deliverCustomerBookingNotificationSafely(
    {
      shopId: input.shopId,
      appointmentId: appointment.id,
      guardianId: appointment.guardian_id,
      petId: appointment.pet_id,
      type: "booking_manage_link_requested" as const,
      recipientPhone: normalizedPhone,
      scheduledAt: nowIso(),
      force: true,
      metadata: { source: "customer_booking_access_recovery" },
    },
    dispatchNotification,
  );
}
