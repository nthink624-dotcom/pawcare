import { redirect } from "next/navigation";

import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; token?: string; date?: string; time?: string; serviceId?: string; serviceOptionId?: string; step?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const initialAccessToken = resolvedSearchParams?.token;
  const initialDate = resolvedSearchParams?.date || "";
  const initialTime = resolvedSearchParams?.time || "";
  const initialServiceId = resolvedSearchParams?.serviceId || "";
  const initialServiceOptionId = resolvedSearchParams?.serviceOptionId || "";
  const requestedStep = Number(resolvedSearchParams?.step);
  const initialMode = requestedMode === "manage" ? "manage" : "first";
  const showFinalOnly = initialMode === "first" && Boolean(initialDate && initialTime);
  const hasSelectedService = Boolean(initialServiceId || initialServiceOptionId);
  const initialFirstVisitStep = showFinalOnly ? 4 : requestedStep === 3 || requestedStep === 4 ? requestedStep : 2;
  const data = await getBootstrap("demo-shop");

  if (initialMode === "first" && !showFinalOnly && !hasSelectedService) {
    redirect("/entry/demo-shop" as never);
  }

  return (
    <CustomerBookingPage
      shopId="demo-shop"
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode={initialMode}
      initialAccessToken={initialAccessToken}
      initialDate={initialDate}
      initialTime={initialTime}
      initialServiceId={initialServiceId}
      initialServiceOptionId={initialServiceOptionId}
      initialFirstVisitStep={initialFirstVisitStep}
      lockFirstVisitStep={showFinalOnly}
      entryHref="/entry/demo-shop"
    />
  );
}
