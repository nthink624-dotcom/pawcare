"use client";

import { useMemo, useState } from "react";

import OwnerAiCareReportSheet from "@/components/owner/owner-ai-care-report-sheet";
import { clearOwnerCareReportLocalDraft } from "@/lib/care-report/owner-care-report-local-draft";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

const fixtureShopId = "dev-care-report-shop";
const fixtureAppointmentId = "dev-care-report-completed-unpublished";

function buildCareReportFixture() {
  const base = buildOwnerDemoBootstrap();
  const sourceAppointment = base.appointments.find((appointment) => appointment.status === "confirmed");
  if (!sourceAppointment) throw new Error("Development fixture requires a confirmed appointment.");
  const appointment = { ...sourceAppointment, id: fixtureAppointmentId, status: "completed" as const };
  const pet = base.pets.find((item) => item.id === appointment.pet_id);
  if (!pet) throw new Error("Development fixture requires a pet.");
  return { appointment, pet, services: base.services };
}

export default function OwnerCareReportDevPreview() {
  const fixture = useMemo(() => buildCareReportFixture(), []);
  const developmentFixture = useMemo(() => ({ items: [], draft: null, visitWeightKg: 3.2 }), []);
  const [isOpen, setIsOpen] = useState(true);

  if (!isOpen) {
    return (
      <main className="mx-auto flex min-h-screen max-w-[430px] flex-col items-center justify-center gap-3 bg-[#f1f3f7] p-4">
        <button type="button" onClick={() => setIsOpen(true)} className="min-h-11 rounded-[10px] bg-[#111a30] px-4 text-[16px] font-medium leading-6 text-white">케어리포트 다시 열기</button>
        <button type="button" onClick={() => clearOwnerCareReportLocalDraft(fixtureShopId, fixtureAppointmentId)} className="min-h-11 rounded-[10px] border border-[#d7e4f2] bg-white px-4 text-[16px] font-medium leading-6 text-[#526b84]">테스트 초안 폐기</button>
      </main>
    );
  }

  return (
    <main data-testid="owner-care-report-dev-preview" className="min-h-screen bg-[#f1f3f7]">
      <OwnerAiCareReportSheet
        shopId={fixtureShopId}
        appointment={fixture.appointment}
        pet={fixture.pet}
        services={fixture.services}
        staffName="개발 미리보기"
        publishedCareReport={null}
        developmentFixture={developmentFixture}
        onClose={() => setIsOpen(false)}
        onReturnToDetail={() => setIsOpen(false)}
        onPublished={() => undefined}
      />
    </main>
  );
}
