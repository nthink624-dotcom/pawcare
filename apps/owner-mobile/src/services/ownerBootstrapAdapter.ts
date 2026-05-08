import type { OwnerBootstrapDto } from "@/types/bootstrap";

export type OwnerBootstrapApiPayload = Omit<OwnerBootstrapDto, "ownerProfile"> & {
  landingInterests?: unknown;
  landingFeedback?: unknown;
};

export type ToOwnerBootstrapDtoOptions = {
  ownerEmail?: string | null;
};

const REQUIRED_ARRAY_FIELDS = ["guardians", "pets", "services", "appointments", "groomingRecords", "notifications"] as const;

export function toOwnerBootstrapDto(payload: OwnerBootstrapApiPayload, options: ToOwnerBootstrapDtoOptions = {}): OwnerBootstrapDto {
  for (const field of REQUIRED_ARRAY_FIELDS) {
    if (!Array.isArray(payload[field])) {
      throw new Error(`Invalid bootstrap payload: ${field} must be an array.`);
    }
  }

  if (!payload.shop || typeof payload.shop !== "object") {
    throw new Error("Invalid bootstrap payload: shop is required.");
  }

  if (payload.mode !== "mock" && payload.mode !== "supabase") {
    throw new Error("Invalid bootstrap payload: mode is required.");
  }

  return {
    mode: payload.mode,
    ownerProfile: {
      email: options.ownerEmail ?? null,
    },
    shop: payload.shop,
    guardians: payload.guardians,
    deletedGuardians: payload.deletedGuardians,
    pets: payload.pets,
    services: payload.services,
    appointments: payload.appointments,
    groomingRecords: payload.groomingRecords,
    notifications: payload.notifications,
  };
}
