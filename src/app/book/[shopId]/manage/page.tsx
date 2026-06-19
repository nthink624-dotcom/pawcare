import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ token?: string; t?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialAccessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;

  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAppointments={data.appointments}
      initialMode="manage"
      initialAccessToken={initialAccessToken}
      entryHref={`/entry/${shopId}`}
    />
  );
}
