import { notFound } from "next/navigation";

import CustomerBookingManagePage from "@/components/customer/customer-booking-manage-page";
import type { CustomerBookingManageLookupPayload } from "@/components/customer/customer-booking-manage-panel";
import { buildDemoBootstrap } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function DemoIncompleteBookingManagePage({
  searchParams,
}: {
  searchParams: Promise<{ initialSetup?: string | string[] }>;
}) {
  const initialSetup = (await searchParams).initialSetup;
  if (process.env.NODE_ENV !== "development" || initialSetup !== "1") notFound();

  const data = buildDemoBootstrap();
  const appointment = data.appointments
    .filter((item) => item.status === "confirmed")
    .sort((a, b) => b.appointment_date.localeCompare(a.appointment_date))[0];
  if (!appointment) notFound();
  const guardian = data.guardians.find((item) => item.id === appointment.guardian_id);
  const pet = data.pets.find((item) => item.id === appointment.pet_id);
  if (!guardian || !pet) notFound();

  const initialLookupResult: CustomerBookingManageLookupPayload = {
    guardians: [guardian],
    pets: [pet],
    appointments: [appointment],
    groomingRecords: [],
    access: { appointmentId: appointment.id, action: "manage" },
  };

  return (
    <CustomerBookingManagePage
      shopId={data.shop.id}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialLookupResult={initialLookupResult}
      entryHref="/demo/book?initialSetup=1"
      operationsLocked
    />
  );
}
