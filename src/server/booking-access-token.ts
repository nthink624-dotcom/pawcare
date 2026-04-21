import { createHmac, timingSafeEqual } from "node:crypto";

import { env } from "@/lib/env";
import { requireServerSecret, serverEnv } from "@/lib/server-env";

type BookingAccessPayload = {
  shopId: string;
  guardianId: string;
  petId: string;
  issuedAt: number;
  expiresAt: number;
};

function getBookingAccessSecret() {
  return requireServerSecret(serverEnv.bookingAccessSecret, "BOOKING_ACCESS_SECRET");
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getBookingAccessSecret()).update(value).digest("base64url");
}

export function createBookingAccessToken(input: {
  shopId: string;
  guardianId: string;
  petId: string;
  expiresInHours?: number;
}) {
  const issuedAt = Date.now();
  const expiresAt = issuedAt + (input.expiresInHours ?? 24 * 14) * 60 * 60 * 1000;
  const payload: BookingAccessPayload = {
    shopId: input.shopId,
    guardianId: input.guardianId,
    petId: input.petId,
    issuedAt,
    expiresAt,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function buildBookingManageUrl(shopId: string, token: string) {
  return `${env.siteUrl.replace(/\/$/, "")}/book/${shopId}/manage?token=${encodeURIComponent(token)}`;
}

export function verifyBookingAccessToken(token: string) {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature) {
    throw new Error("Invalid booking access link.");
  }

  const expectedSignature = sign(encodedPayload);
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    throw new Error("Invalid booking access link.");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as BookingAccessPayload;
  if (!payload.shopId || !payload.guardianId || !payload.petId) {
    throw new Error("Invalid booking access link.");
  }

  if (payload.expiresAt < Date.now()) {
    throw new Error("Expired booking access link.");
  }

  return payload;
}
