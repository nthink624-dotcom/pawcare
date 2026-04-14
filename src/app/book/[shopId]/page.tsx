import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const initialAccessToken = resolvedSearchParams?.token;
  const initialMode = requestedMode === "returning" || requestedMode === "manage" ? requestedMode : "first";
  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode={initialMode}
      initialAccessToken={initialAccessToken}
      entryHref={`/entry/${shopId}`}
    />
  );
}
