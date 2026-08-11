import { redirect } from "next/navigation";

import CustomerBookingEntryPage from "@/components/customer/customer-booking-entry-page";
import { isDevelopmentDemoShopId } from "@/lib/development-demo";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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
    experience?: string;
  }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const encodedShopId = encodeURIComponent(shopId);
  const bookingHref =
    isDevelopmentDemoShopId(shopId) && resolvedSearchParams?.experience === "first"
      ? `/book/${encodedShopId}?experience=first`
      : undefined;

  if (requestedMode === "manage") {
    const manageUrl = new URL(`/book/${encodedShopId}/manage`, "http://localhost");
    const accessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;

    if (accessToken) {
      manageUrl.searchParams.set("t", accessToken);
    }

    redirect(`${manageUrl.pathname}${manageUrl.search}` as never);
  }

  const data = await getBootstrap(shopId);
  return (
    <CustomerBookingEntryPage
      shop={data.shop}
      services={data.services}
      staffMembers={data.staffMembers}
      ownerProfile={data.ownerProfile}
      infoHref={`/book/${encodedShopId}/info`}
      bookingHref={bookingHref}
    />
  );
}
