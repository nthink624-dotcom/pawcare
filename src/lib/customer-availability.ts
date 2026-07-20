import { fetchApiJson } from "@/lib/api";

export type RecommendationSource = "ai" | "rule";

export type CustomerAvailabilityPayload = {
  slots: string[];
  recommendedSlots?: string[];
  recommendationSource?: RecommendationSource;
};

type CustomerAvailabilityParams = {
  shopId: string;
  date: string;
  serviceId?: string;
  previewDurationMinutes?: number;
  staffId?: string | null;
  excludeAppointmentId?: string;
};

const dedupeWindowMs = 2_000;
const availabilityRequests = new Map<
  string,
  { expiresAt: number; request: Promise<CustomerAvailabilityPayload> }
>();

export function fetchCustomerAvailability(params: CustomerAvailabilityParams) {
  const query = new URLSearchParams({ shopId: params.shopId, date: params.date });
  if (params.serviceId) query.set("serviceId", params.serviceId);
  if (params.previewDurationMinutes) query.set("previewDurationMinutes", String(params.previewDurationMinutes));
  if (params.staffId) query.set("staffId", params.staffId);
  if (params.excludeAppointmentId) query.set("excludeAppointmentId", params.excludeAppointmentId);

  const requestPath = `/api/availability?${query.toString()}`;
  const now = Date.now();
  const cached = availabilityRequests.get(requestPath);
  if (cached && cached.expiresAt > now) {
    return cached.request;
  }

  for (const [key, entry] of availabilityRequests) {
    if (entry.expiresAt <= now) availabilityRequests.delete(key);
  }

  const request = fetchApiJson<CustomerAvailabilityPayload>(requestPath, {
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
  }).catch((error) => {
    availabilityRequests.delete(requestPath);
    throw error;
  });

  availabilityRequests.set(requestPath, {
    expiresAt: now + dedupeWindowMs,
    request,
  });
  return request;
}
