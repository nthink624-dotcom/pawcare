export type ReservationStatus = "pending" | "confirmed" | "in_progress" | "almost_done" | "completed" | "cancelled";

export type ReservationSummary = {
  id: string;
  appointmentDate: string;
  appointmentTime: string;
  status: ReservationStatus;
  guardianName: string;
  petName: string;
  serviceName: string;
};

export type CustomerSummary = {
  id: string;
  guardianName: string;
  phone: string;
  petNames: string[];
};
