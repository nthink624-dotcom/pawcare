import CustomerBookingManagePage from "@/components/customer/customer-booking-manage-page";
import CustomerBookingUnavailable from "@/components/customer/customer-booking-unavailable";
import { getBootstrapOwnerInitialSetupReadiness } from "@/lib/owner-initial-setup-readiness";
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

  const data = await getBootstrap(shopId).catch(() => null);
  if (!data) return <CustomerBookingUnavailable />;
  const encodedShopId = encodeURIComponent(shopId);
  const operationsLocked = !getBootstrapOwnerInitialSetupReadiness(data).completed;

  return (
    <CustomerBookingManagePage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAccessToken={initialAccessToken}
      entryHref={`/entry/${encodedShopId}`}
      operationsLocked={operationsLocked}
    />
  );
}
