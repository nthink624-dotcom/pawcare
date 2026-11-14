"use client";

import { useEffect, useMemo } from "react";

import { fetchApiJsonWithAuth } from "@/lib/api";
import { createOwnerBackgroundPoller } from "@/lib/owner-background-poller";
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

export default function OwnerBookingNotificationWatcher({ shopId, initialNotifications }: Props) {
  const initialNotificationSignature = useMemo(
    () =>
      JSON.stringify(initialNotifications
        .filter((notification) => notification.type === "owner_booking_requested" && notification.status === "sent")
        .map((notification) => notification.id)
        .sort()),
    [initialNotifications],
  );

  useEffect(() => {
    let active = true;
    let knownNotificationIds = new Set<string>(JSON.parse(initialNotificationSignature));
    const poller = createOwnerBackgroundPoller({
      intervalMs: 30_000,
      canRun: () => document.visibilityState === "visible" && navigator.onLine !== false,
      run: async (signal) => {
        const next = await fetchApiJsonWithAuth<OwnerBookingNotificationSnapshot>(
          `/api/owner/booking-notification-snapshot?shopId=${encodeURIComponent(shopId)}`,
          { cache: "no-store", signal },
        );
        if (!active || signal.aborted) return;

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
      },
    });

    const handleFocus = () => void poller.request();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void poller.request();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      active = false;
      poller.stop();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [initialNotificationSignature, shopId]);

  return null;
}
