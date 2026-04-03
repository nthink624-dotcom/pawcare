import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getPublicBootstrap } from "@/lib/api";

export default async function BookManagePage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const data = await getPublicBootstrap(shopId);

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode="manage"
      entryHref={`/entry/${shopId}`}
    />
  );
}
