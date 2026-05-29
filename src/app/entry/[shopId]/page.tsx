import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function EntryPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{
    mode?: string;
    token?: string;
    t?: string;
    date?: string;
    time?: string;
    serviceId?: string;
    serviceOptionId?: string;
    step?: string;
  }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialAccessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;
  const initialDate = resolvedSearchParams?.date || "";
  const initialTime = resolvedSearchParams?.time || "";
  const initialServiceId = resolvedSearchParams?.serviceId || "";
  const initialServiceOptionId = resolvedSearchParams?.serviceOptionId || "";
  const requestedStep = Number(resolvedSearchParams?.step);
  const hasSelectedService = Boolean(initialServiceId || initialServiceOptionId);

  const data = await getBootstrap(shopId);

  if (hasSelectedService) {
    const initialFirstVisitStep = requestedStep === 3 || requestedStep === 4 ? requestedStep : 2;

    return (
      <CustomerBookingPage
        shopId={shopId}
        initialShop={data.shop}
        initialServices={data.services}
        initialStaffMembers={data.staffMembers}
        initialAppointments={data.appointments}
        initialRecords={data.groomingRecords}
        initialMode="first"
        initialAccessToken={initialAccessToken}
        initialDate={initialDate}
        initialTime={initialTime}
        initialServiceId={initialServiceId}
        initialServiceOptionId={initialServiceOptionId}
        initialFirstVisitStep={initialFirstVisitStep}
        entryHref={`/entry/${shopId}`}
      />
    );
  }

  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services.filter((item) => item.is_active)}
      bookingHref={`/entry/${shopId}`}
      infoHref={`/book/${shopId}/info`}
    />
  );
}
