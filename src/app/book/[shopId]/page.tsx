import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const data = await getBootstrap(shopId);
  return <CustomerBookingPage shopId={shopId} initialShop={data.shop} initialServices={data.services} initialAppointments={data.appointments} initialRecords={data.groomingRecords} />;
}

