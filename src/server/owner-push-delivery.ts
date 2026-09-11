import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

import { buildOwnerBookingRequestedPushPayload } from "@/lib/owner-push-payload";
import { hasFirebaseMessagingServerEnv, serverEnv } from "@/lib/server-env";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { nowIso } from "@/lib/utils";
import type { Appointment } from "@/types/domain";

const FIREBASE_APP_NAME = "petmanager-owner-push";
const defaultAndroidChannelId = "owner-bookings-sound-v1";
const androidChannelIds = new Set([
  "owner-bookings-sound-v1",
  "owner-bookings-vibrate-v1",
  "owner-bookings-silent-v1",
]);

type OwnerPushToken = {
  id: string;
  push_token: string;
  metadata: Record<string, unknown> | null;
};

type OwnerBookingPushInput = {
  notificationId: string;
  appointment: Pick<Appointment, "id" | "shop_id" | "guardian_id" | "pet_id" | "service_id" | "staff_id" | "appointment_date" | "appointment_time">;
  guardianName: string;
  petName: string;
  serviceName: string;
};

type OwnerPushDeliveryResult = {
  configured: boolean;
  attempted: number;
  sent: number;
  failed: number;
  deactivated: number;
};

function formatAppointmentDate(date: string) {
  const parsed = new Date(`${date}T00:00:00+09:00`);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
    timeZone: "Asia/Seoul",
  }).format(parsed);
}

function parseServiceAccountJson() {
  if (!serverEnv.firebaseServiceAccountJson) return null;

  try {
    const parsed = JSON.parse(serverEnv.firebaseServiceAccountJson) as Record<string, unknown>;
    const projectId = typeof parsed.project_id === "string" ? parsed.project_id.trim() : "";
    const clientEmail = typeof parsed.client_email === "string" ? parsed.client_email.trim() : "";
    const privateKey = typeof parsed.private_key === "string" ? parsed.private_key.replace(/\\n/g, "\n") : "";

    return projectId && clientEmail && privateKey ? { projectId, clientEmail, privateKey } : null;
  } catch {
    return null;
  }
}

function getServiceAccount() {
  const serviceAccountJson = parseServiceAccountJson();
  if (serviceAccountJson) return serviceAccountJson;

  if (serverEnv.firebaseProjectId && serverEnv.firebaseClientEmail && serverEnv.firebasePrivateKey) {
    return {
      projectId: serverEnv.firebaseProjectId,
      clientEmail: serverEnv.firebaseClientEmail,
      privateKey: serverEnv.firebasePrivateKey,
    };
  }

  return null;
}

function getAndroidChannelId(metadata: OwnerPushToken["metadata"]) {
  const candidate = metadata?.androidChannelId;
  return typeof candidate === "string" && androidChannelIds.has(candidate)
    ? candidate
    : defaultAndroidChannelId;
}

function isBookingRequestedPushEnabled(metadata: OwnerPushToken["metadata"]) {
  return metadata?.bookingRequestedEnabled !== false;
}

function shouldDeactivateToken(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return false;
  const code = String(error.code);
  return code === "messaging/registration-token-not-registered" || code === "messaging/invalid-registration-token";
}

function getMessagingClient() {
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return null;

  const app = getApps().find((item) => item.name === FIREBASE_APP_NAME) ?? initializeApp(
    {
      credential: cert(serviceAccount),
    },
    FIREBASE_APP_NAME,
  );

  return getMessaging(app);
}

async function deactivateToken(tokenId: string) {
  const admin = getSupabaseAdmin();
  if (!admin) return false;

  const result = await admin
    .from("owner_push_tokens")
    .update({
      enabled: false,
      disabled_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("id", tokenId);

  return !result.error;
}

export async function sendOwnerBookingRequestedPush(input: OwnerBookingPushInput): Promise<OwnerPushDeliveryResult> {
  if (!hasFirebaseMessagingServerEnv()) {
    console.info("[owner-push] FCM send skipped: Firebase server credentials are not configured.");
    return { configured: false, attempted: 0, sent: 0, failed: 0, deactivated: 0 };
  }

  const admin = getSupabaseAdmin();
  const messaging = getMessagingClient();
  if (!admin || !messaging) {
    console.warn("[owner-push] FCM send skipped: Firebase or Supabase server client is unavailable.");
    return { configured: false, attempted: 0, sent: 0, failed: 0, deactivated: 0 };
  }

  const tokensResult = await admin
    .from("owner_push_tokens")
    .select("id,push_token,metadata")
    .eq("shop_id", input.appointment.shop_id)
    .eq("provider", "fcm")
    .eq("platform", "android")
    .eq("enabled", true)
    .is("disabled_at", null)
    .is("staff_member_id", null);

  if (tokensResult.error) {
    console.warn("[owner-push] FCM token lookup failed", { reason: tokensResult.error.message });
    return { configured: true, attempted: 0, sent: 0, failed: 0, deactivated: 0 };
  }

  const payload = buildOwnerBookingRequestedPushPayload({
    notificationId: input.notificationId,
    shopId: input.appointment.shop_id,
    appointmentId: input.appointment.id,
    guardianId: input.appointment.guardian_id,
    petId: input.appointment.pet_id,
    serviceId: input.appointment.service_id,
    staffId: input.appointment.staff_id,
    guardianName: input.guardianName,
    petName: input.petName,
    appointmentDateLabel: formatAppointmentDate(input.appointment.appointment_date),
    appointmentTime: input.appointment.appointment_time,
    serviceName: input.serviceName,
  });

  let sent = 0;
  let failed = 0;
  let deactivated = 0;
  const tokens = ((tokensResult.data ?? []) as OwnerPushToken[]).filter((token) =>
    isBookingRequestedPushEnabled(token.metadata),
  );

  for (const token of tokens) {
    try {
      await messaging.send({
        token: token.push_token,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: {
          kind: payload.kind,
          notificationId: payload.notificationId ?? "",
          shopId: payload.shopId,
          appointmentId: payload.appointmentId,
          guardianId: payload.guardianId ?? "",
          petId: payload.petId ?? "",
          serviceId: payload.serviceId ?? "",
          staffId: payload.staffId ?? "",
          routeTab: payload.route.tab,
          routeScreen: payload.route.screen,
          reservationId: payload.route.params.reservationId,
        },
        android: {
          priority: "high",
          ttl: 24 * 60 * 60 * 1000,
          notification: {
            channelId: getAndroidChannelId(token.metadata),
            priority: "high",
            visibility: "private",
          },
        },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      if (shouldDeactivateToken(error) && (await deactivateToken(token.id))) {
        deactivated += 1;
      }
      console.warn("[owner-push] FCM delivery failed", {
        tokenId: token.id,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.info("[owner-push] FCM delivery result", {
    shopId: input.appointment.shop_id,
    appointmentId: input.appointment.id,
    attempted: tokens.length,
    sent,
    failed,
    deactivated,
  });

  return { configured: true, attempted: tokens.length, sent, failed, deactivated };
}
