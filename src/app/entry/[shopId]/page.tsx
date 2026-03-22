import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { getBootstrap } from "@/server/repositories/app-repository";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services.filter((item) => item.is_active)}
      bookingHref={`/book/${shopId}`}
      manageHref={`/book/${shopId}?mode=manage`}
    />
  );
}