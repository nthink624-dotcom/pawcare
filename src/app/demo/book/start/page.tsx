import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function DemoBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; token?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const initialAccessToken = resolvedSearchParams?.token;
  const initialMode = requestedMode === "returning" || requestedMode === "manage" ? requestedMode : "first";
  const data = await getBootstrap("demo-shop");

  return (
    <CustomerBookingPage
      shopId="demo-shop"
      initialShop={data.shop}
      initialServices={data.services}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode={initialMode}
      initialAccessToken={initialAccessToken}
      entryHref="/demo/book"
    />
  );
}
