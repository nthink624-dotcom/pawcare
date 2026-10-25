"use client";

import { useEffect, useMemo } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import {
  OWNER_PUSH_RECEIVED_EVENT,
  type OwnerPushReceivedEventDetail,
} from "@/lib/push/owner-push-notifications";
import type { BootstrapPayload } from "@/types/domain";

type Props = {
  shopId: string;
  initialNotifications: BootstrapPayload["notifications"];
};

type OwnerBookingNotificationSnapshot = {
  notifications: Array<{
    id: string;
    appointmentId: string | null;
  }>;
};

function getOwnerBookingNotificationIds(notifications: BootstrapPayload["notifications"]) {
  return new Set(
    notifications
      .filter((notification) => notification.type === "owner_booking_requested" && notification.status === "sent")
      .map((notification) => notification.id),
  );
}

export default function OwnerBookingNotificationWatcher({ shopId, initialNotifications }: Props) {
  const initialNotificationSignature = useMemo(
    () =>
      initialNotifications
        .filter((notification) => notification.type === "owner_booking_requested" && notification.status === "sent")
        .map((notification) => notification.id)
        .join(":"),
    [initialNotifications],
  );

  useEffect(() => {
    let active = true;
    let knownNotificationIds = getOwnerBookingNotificationIds(initialNotifications);

    const checkForNewBookings = async () => {
      if (document.visibilityState !== "visible") return;

      try {
        const next = await fetchApiJsonWithAuth<OwnerBookingNotificationSnapshot>(
          `/api/owner/booking-notification-snapshot?shopId=${encodeURIComponent(shopId)}`,
          { cache: "no-store" },
        );
        if (!active) return;

        const newBookingNotification = next.notifications.find((notification) => !knownNotificationIds.has(notification.id));
        knownNotificationIds = new Set(next.notifications.map((notification) => notification.id));

        if (!newBookingNotification?.appointmentId) return;

        const detail: OwnerPushReceivedEventDetail = {
          kind: "owner_booking_requested",
          shopId,
          appointmentId: newBookingNotification.appointmentId,
          opened: false,
        };
        window.dispatchEvent(new CustomEvent<OwnerPushReceivedEventDetail>(OWNER_PUSH_RECEIVED_EVENT, { detail }));
      } catch {
        // The next visible refresh retries. A missed background refresh must not
        // interrupt the owner while they are editing an appointment.
      }
    };

    const handleFocus = () => void checkForNewBookings();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void checkForNewBookings();
    };

    const intervalId = window.setInterval(checkForNewBookings, 10_000);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialNotificationSignature, initialNotifications, shopId]);

  return null;
}
