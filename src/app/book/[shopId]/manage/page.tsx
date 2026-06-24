import CustomerBookingManagePage from "@/components/customer/customer-booking-manage-page";
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
  const encodedShopId = encodeURIComponent(shopId);

  return (
    <CustomerBookingManagePage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAccessToken={initialAccessToken}
      entryHref={`/entry/${encodedShopId}`}
    />
  );
}
