import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
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
  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services.filter((item) => item.is_active)}
      infoHref={`/book/${shopId}/info`}
    />
  );
}
