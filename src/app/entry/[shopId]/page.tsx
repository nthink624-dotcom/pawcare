import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { getPublicBootstrap } from "@/lib/api";

export default async function EntryPage({
  params,
}: {
  params: Promise<{ shopId: string }>;
}) {
  const { shopId } = await params;
  const data = await getPublicBootstrap(shopId);

  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services.filter((item) => item.is_active)}
      bookingHref={`/book/${shopId}`}
      manageHref={`/book/${shopId}/manage`}
      infoHref={`/book/${shopId}/info`}
    />
  );
}
