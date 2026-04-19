import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function DemoBookingEntryPage() {
  const data = await getBootstrap("demo-shop");

  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services.filter((item) => item.is_active)}
      bookingHref="/demo/book/start"
      infoHref="/demo/book/info"
    />
  );
}
