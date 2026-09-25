import { fetchApiJsonWithAuth } from "@/lib/api";

export type VisitWeightMeasurement = Readonly<{
  appointmentId: string;
  petId: string;
  weightKg: number;
  measuredAt: string;
}>;

export type AppointmentVisitWeightResponse = Readonly<{
  current: VisitWeightMeasurement | null;
  recent: VisitWeightMeasurement | null;
}>;

export type SaveAppointmentVisitWeightInput = Readonly<{
  shopId: string;
  appointmentId: string;
  weightKg: number;
  idempotencyKey: string;
}>;

export type OwnerAppointmentVisitWeightTransport = Readonly<{
  fetch: (shopId: string, appointmentId: string) => Promise<AppointmentVisitWeightResponse>;
  put: (input: SaveAppointmentVisitWeightInput) => Promise<VisitWeightMeasurement>;
}>;

export async function fetchOwnerAppointmentVisitWeight(
  shopId: string,
  appointmentId: string,
): Promise<AppointmentVisitWeightResponse> {
  const query = new URLSearchParams({ shopId, appointmentId });
  return fetchApiJsonWithAuth<AppointmentVisitWeightResponse>(
    `/api/owner/appointment-visit-weight?${query.toString()}`,
    { method: "GET", cache: "no-store" },
  );
}

export async function putOwnerAppointmentVisitWeight(
  input: SaveAppointmentVisitWeightInput,
): Promise<VisitWeightMeasurement> {
  const result = await fetchApiJsonWithAuth<{ measurement: VisitWeightMeasurement }>(
    "/api/owner/appointment-visit-weight",
    {
      method: "PUT",
      cache: "no-store",
      body: JSON.stringify(input),
    },
  );
  return result.measurement;
}

export const ownerAppointmentVisitWeightTransport: OwnerAppointmentVisitWeightTransport = {
  fetch: fetchOwnerAppointmentVisitWeight,
  put: putOwnerAppointmentVisitWeight,
};
