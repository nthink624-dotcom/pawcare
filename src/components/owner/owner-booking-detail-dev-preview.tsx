"use client";

import { useMemo, useRef, useState } from "react";

import { AppointmentDetail } from "@/components/owner/owner-app";
import {
  type AppointmentVisitWeightResponse,
  type OwnerAppointmentVisitWeightTransport,
  type SaveAppointmentVisitWeightInput,
  type VisitWeightMeasurement,
} from "@/lib/owner-appointment-visit-weight";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

const fixtureAppointmentId = "dev-booking-detail-200pct";

function buildBookingDetailFixture() {
  const base = buildOwnerDemoBootstrap();
  const sourceAppointment = base.appointments.find((appointment) => appointment.status === "confirmed");
  if (!sourceAppointment) throw new Error("Development fixture requires a confirmed appointment.");

  const appointment = {
    ...sourceAppointment,
    id: fixtureAppointmentId,
    memo: "피부가 예민해 귀 주변은 천천히 정리해 주세요. 긴 요청도 빠짐없이 확인합니다.",
  };
  const pet = base.pets.find((item) => item.id === appointment.pet_id);
  const guardian = base.guardians.find((item) => item.id === appointment.guardian_id);
  const service = base.services.find((item) => item.id === appointment.service_id);
  if (!pet || !guardian || !service) throw new Error("Development fixture references must resolve.");

  const previewPet = { ...pet, name: "아주 긴 이름의 반려동물 가나다라마바사아자차카타파하" };
  const previewGuardian = { ...guardian, name: "긴 한국어 보호자 이름 가나다라마바사아자차카타", phone: "010-1234-5678" };
  const data = {
    ...base,
    appointments: base.appointments.map((item) => item.id === sourceAppointment.id ? appointment : item),
    pets: base.pets.map((item) => item.id === pet.id ? previewPet : item),
    guardians: base.guardians.map((item) => item.id === guardian.id ? previewGuardian : item),
  };

  return { appointment, data, guardian: previewGuardian, pet: previewPet, service };
}

export default function OwnerBookingDetailDevPreview() {
  const fixture = useMemo(() => buildBookingDetailFixture(), []);
  const [appointment, setAppointment] = useState(fixture.appointment);
  const [isOpen, setIsOpen] = useState(true);
  const [requestCounts, setRequestCounts] = useState({ get: 0, put: 0, cancel: 0 });
  const weightsRef = useRef<AppointmentVisitWeightResponse>({
    current: {
      appointmentId: fixtureAppointmentId,
      petId: fixture.pet.id,
      weightKg: 4.8,
      measuredAt: "2026-09-08T01:00:00.000Z",
    },
    recent: {
      appointmentId: "dev-earlier-appointment",
      petId: fixture.pet.id,
      weightKg: 4.6,
      measuredAt: "2026-09-01T01:00:00.000Z",
    },
  });

  const transport = useMemo<OwnerAppointmentVisitWeightTransport>(() => ({
    fetch: async () => {
      setRequestCounts((current) => ({ ...current, get: current.get + 1 }));
      return weightsRef.current;
    },
    put: async (input: SaveAppointmentVisitWeightInput): Promise<VisitWeightMeasurement> => {
      const measurement = {
        appointmentId: input.appointmentId,
        petId: fixture.pet.id,
        weightKg: input.weightKg,
        measuredAt: "2026-09-08T01:00:00.000Z",
      };
      weightsRef.current = { ...weightsRef.current, current: measurement };
      setRequestCounts((current) => ({ ...current, put: current.put + 1 }));
      return measurement;
    },
  }), [fixture.pet.id]);

  const fixtureData = useMemo(
    () => ({ ...fixture.data, appointments: fixture.data.appointments.map((item) => item.id === fixtureAppointmentId ? appointment : item) }),
    [appointment, fixture.data],
  );

  if (!isOpen) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[430px] items-center justify-center bg-[#f1f3f7] p-4">
        <button type="button" onClick={() => setIsOpen(true)} className="min-h-11 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white">예약 상세 다시 열기</button>
      </main>
    );
  }

  return (
    <main data-testid="owner-booking-detail-dev-preview" className="min-h-screen bg-[#f1f3f7]">
      <AppointmentDetail
        data={fixtureData}
        appointment={appointment}
        pet={fixture.pet}
        guardian={fixture.guardian}
        service={fixture.service}
        saving={false}
        canViewGuardianContact
        showMediaHistory={false}
        visitWeightTransport={transport}
        onClose={() => setIsOpen(false)}
        onOpenCareReport={() => undefined}
        onUpdate={(payload) => {
          if ("status" in payload && payload.status === "cancelled") {
            setRequestCounts((current) => ({ ...current, cancel: current.cancel + 1 }));
            setAppointment((current) => ({ ...current, status: "cancelled" }));
          }
        }}
      />
      <output aria-live="polite" className="sr-only" data-testid="booking-detail-preview-request-counts">
        GET {requestCounts.get}, PUT {requestCounts.put}, 취소 {requestCounts.cancel}
      </output>
    </main>
  );
}
