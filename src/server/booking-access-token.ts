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

export const BOOKING_ACCESS_QUERY_KEY = "t";

function getBookingAccessSecret() {
  return requireServerSecret(serverEnv.bookingAccessSecret, "BOOKING_ACCESS_SECRET");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getBookingAccessSecret()).update(value).digest("base64url");
}

function encodeCompactPayload(payload: BookingAccessPayload) {
  return [
    payload.shopId,
    payload.guardianId,
    payload.petId,
    payload.issuedAt.toString(36),
    payload.expiresAt.toString(36),
  ].join("~");
}

function decodeCompactPayload(encodedPayload: string): BookingAccessPayload | null {
  const [shopId, guardianId, petId, issuedAt, expiresAt] = encodedPayload.split("~");
  if (!shopId || !guardianId || !petId || !issuedAt || !expiresAt) {
    return null;
  }

  const issuedAtNumber = Number.parseInt(issuedAt, 36);
  const expiresAtNumber = Number.parseInt(expiresAt, 36);
  if (!Number.isFinite(issuedAtNumber) || !Number.isFinite(expiresAtNumber)) {
    return null;
  }

  return {
    shopId,
    guardianId,
    petId,
    issuedAt: issuedAtNumber,
    expiresAt: expiresAtNumber,
  };
}

function decodePayload(encodedPayload: string): BookingAccessPayload {
  const compactPayload = decodeCompactPayload(encodedPayload);
  if (compactPayload) {
    return compactPayload;
  }

  return JSON.parse(base64UrlDecode(encodedPayload)) as BookingAccessPayload;
}

function resolvePublicSiteUrl() {
  const configured = (env.siteUrl || "").trim().replace(/\/$/, "");

  if (process.env.VERCEL_ENV === "production" && configured.includes(".vercel.app")) {
    return "https://www.petmanager.co.kr";
  }

  return configured || "http://localhost:3000";
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

  const encodedPayload = encodeCompactPayload(payload);
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function buildBookingManageUrl(shopId: string, token: string) {
  return `${resolvePublicSiteUrl()}/book/${shopId}/manage?${BOOKING_ACCESS_QUERY_KEY}=${encodeURIComponent(token)}`;
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

  const payload = decodePayload(encodedPayload);
  if (!payload.shopId || !payload.guardianId || !payload.petId) {
    throw new Error("Invalid booking access link.");
  }

  if (payload.expiresAt < Date.now()) {
    throw new Error("Expired booking access link.");
  }

  return payload;
}
