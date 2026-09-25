export type VisitWeightMeasurement = {
  appointmentId: string;
  petId: string;
  weightKg: number;
  measuredAt: string;
};

export type AppointmentVisitWeightResponse = {
  current: VisitWeightMeasurement | null;
  recent: VisitWeightMeasurement | null;
};

export type SaveAppointmentVisitWeightInput = {
  shopId: string;
  appointmentId: string;
  weightKg: number;
  idempotencyKey: string;
};
