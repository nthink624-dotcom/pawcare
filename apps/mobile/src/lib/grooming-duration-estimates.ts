import { estimatePetServiceDuration } from "@petmanager/shared/lib/pet-duration-estimate";
import type { DurationEstimate } from "@petmanager/shared/lib/duration-statistics";

import type { Appointment, GroomingRecord, Pet, Service } from "@/types/domain";

type DurationContext = {
  appointments: Appointment[];
  groomingRecords: GroomingRecord[];
  service: Service;
  pet: Pet | undefined;
};

export function getGroomingDurationEstimate(context: DurationContext): DurationEstimate {
  return estimatePetServiceDuration(context);
}
