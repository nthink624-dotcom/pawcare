import type { ServiceDurationRecommendation } from "@/types/profitability";

import { getActualGroomingDurationMinutes } from "@/lib/appointment-time";
import {
  MIN_DURATION_SAMPLE_SIZE,
  summarizeDurationMinutes,
} from "@/lib/duration-statistics";

export const MIN_SERVICE_DURATION_RECOMMENDATION_SAMPLE_SIZE = MIN_DURATION_SAMPLE_SIZE;

type DurationRecommendationRecord = {
  id: string;
  appointment_id: string | null;
  pet_id: string;
  service_id: string;
  actual_duration_minutes: number | string | null;
  pet_weight_snapshot?: number | string | null;
};

type DurationRecommendationAppointment = {
  id: string;
  service_id: string;
  status: string;
  actual_started_at: string | null;
  actual_completed_at: string | null;
};

type DurationRecommendationService = {
  id: string;
  name: string;
};

type DurationRecommendationPet = {
  id: string;
  name: string;
};

function positiveNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function buildServiceDurationRecommendations({
  shopId,
  records,
  appointments,
  services,
}: {
  shopId: string;
  records: DurationRecommendationRecord[];
  appointments: DurationRecommendationAppointment[];
  services: DurationRecommendationService[];
}): ServiceDurationRecommendation[] {
  if (!shopId) return [];

  const appointmentById = new Map(appointments.map((appointment) => [appointment.id, appointment]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const recordCountByAppointment = new Map<string, number>();
  for (const record of records) {
    if (!record.appointment_id) continue;
    recordCountByAppointment.set(
      record.appointment_id,
      (recordCountByAppointment.get(record.appointment_id) ?? 0) + 1,
    );
  }

  const grouped = new Map<string, {
    serviceId: string;
    serviceName: string;
    roundedWeightKg: number;
    actualMinutes: number[];
  }>();

  for (const record of records) {
    if (!record.appointment_id || recordCountByAppointment.get(record.appointment_id) !== 1) continue;
    const appointment = appointmentById.get(record.appointment_id);
    const service = serviceById.get(record.service_id);
    if (!appointment || appointment.status !== "completed" || !service) continue;
    if (appointment.service_id !== record.service_id) continue;

    const elapsedMinutes = getActualGroomingDurationMinutes(
      appointment.actual_started_at,
      appointment.actual_completed_at,
    );
    const persistedMinutes = positiveNumber(record.actual_duration_minutes);
    if (elapsedMinutes === null || persistedMinutes === null || persistedMinutes !== elapsedMinutes) continue;

    const weightKg = positiveNumber(record.pet_weight_snapshot);
    const roundedWeightKg = weightKg === null ? 0 : Math.round(weightKg);
    if (roundedWeightKg <= 0) continue;

    const key = `${shopId}|${record.service_id}|${roundedWeightKg}kg`;
    const current = grouped.get(key);
    if (current) {
      current.actualMinutes.push(elapsedMinutes);
    } else {
      grouped.set(key, {
        serviceId: record.service_id,
        serviceName: service.name.trim() || "서비스명 미입력",
        roundedWeightKg,
        actualMinutes: [elapsedMinutes],
      });
    }
  }

  return Array.from(grouped.entries())
    .filter(([, group]) => group.actualMinutes.length >= MIN_SERVICE_DURATION_RECOMMENDATION_SAMPLE_SIZE)
    .map<ServiceDurationRecommendation>(([key, group]) => {
      const stats = summarizeDurationMinutes(group.actualMinutes);
      return {
        key,
        shopId,
        serviceId: group.serviceId,
        serviceName: group.serviceName,
        roundedWeightKg: group.roundedWeightKg,
        weightLabel: `${group.roundedWeightKg}kg`,
        sampleCount: stats.sampleCount,
        observedAverageMinutes: stats.averageMinutes ?? 0,
        observedMedianMinutes: stats.medianMinutes ?? 0,
        recommendedMinutes: stats.recommendedMinutes ?? 0,
      };
    })
    .sort((left, right) =>
      left.serviceName.localeCompare(right.serviceName, "ko") ||
      left.roundedWeightKg - right.roundedWeightKg ||
      left.serviceId.localeCompare(right.serviceId),
    );
}

export function buildPetDurationRecommendations({
  records,
  appointments,
  services,
  pets,
}: {
  records: DurationRecommendationRecord[];
  appointments: DurationRecommendationAppointment[];
  services: DurationRecommendationService[];
  pets: DurationRecommendationPet[];
}) {
  const appointmentById = new Map(appointments.map((appointment) => [appointment.id, appointment]));
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const petById = new Map(pets.map((pet) => [pet.id, pet]));
  const recordCountByAppointment = new Map<string, number>();

  for (const record of records) {
    if (!record.appointment_id) continue;
    recordCountByAppointment.set(
      record.appointment_id,
      (recordCountByAppointment.get(record.appointment_id) ?? 0) + 1,
    );
  }

  const grouped = new Map<string, {
    petId: string;
    petName: string;
    serviceId: string;
    serviceName: string;
    actualMinutes: number[];
  }>();

  for (const record of records) {
    if (!record.appointment_id || recordCountByAppointment.get(record.appointment_id) !== 1) continue;
    const appointment = appointmentById.get(record.appointment_id);
    const service = serviceById.get(record.service_id);
    const pet = petById.get(record.pet_id);
    if (!appointment || appointment.status !== "completed" || !service || !pet) continue;
    if (appointment.service_id !== record.service_id) continue;

    const elapsedMinutes = getActualGroomingDurationMinutes(
      appointment.actual_started_at,
      appointment.actual_completed_at,
    );
    const persistedMinutes = positiveNumber(record.actual_duration_minutes);
    if (elapsedMinutes === null || persistedMinutes === null || persistedMinutes !== elapsedMinutes) continue;

    const key = `${record.pet_id}|${record.service_id}`;
    const current = grouped.get(key);
    if (current) {
      current.actualMinutes.push(elapsedMinutes);
    } else {
      grouped.set(key, {
        petId: record.pet_id,
        petName: pet.name.trim() || "반려동물",
        serviceId: record.service_id,
        serviceName: service.name.trim() || "서비스명 미입력",
        actualMinutes: [elapsedMinutes],
      });
    }
  }

  return Array.from(grouped.entries())
    .filter(([, group]) => group.actualMinutes.length >= MIN_SERVICE_DURATION_RECOMMENDATION_SAMPLE_SIZE)
    .map(([key, group]) => {
      const stats = summarizeDurationMinutes(group.actualMinutes);
      return {
        key,
        petId: group.petId,
        petName: group.petName,
        serviceId: group.serviceId,
        serviceName: group.serviceName,
        sampleCount: stats.sampleCount,
        observedAverageMinutes: stats.averageMinutes ?? 0,
        observedMedianMinutes: stats.medianMinutes ?? 0,
        recommendedMinutes: stats.recommendedMinutes ?? 0,
      };
    })
    .sort((left, right) =>
      left.petName.localeCompare(right.petName, "ko") ||
      left.serviceName.localeCompare(right.serviceName, "ko") ||
      left.petId.localeCompare(right.petId),
    );
}
