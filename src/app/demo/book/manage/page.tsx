import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function DemoBookManagePage({
  searchParams,
}: {
  searchParams?: Promise<{ token?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const data = await getBootstrap("demo-shop");

  return (
    <CustomerBookingPage
      shopId="demo-shop"
      initialShop={data.shop}
      initialServices={data.services}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode="manage"
      initialAccessToken={resolvedSearchParams?.token}
      entryHref="/demo/book"
    />
  );
}
