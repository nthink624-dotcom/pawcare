import { redirect } from "next/navigation";

import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string; t?: string; date?: string; time?: string; serviceId?: string; serviceOptionId?: string; step?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const encodedShopId = encodeURIComponent(shopId);

  if (requestedMode === "manage") {
    const manageUrl = new URL(shopId === "demo-shop" ? "/demo/book/manage" : `/book/${encodedShopId}/manage`, "http://localhost");
    const accessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;

    if (accessToken) {
      manageUrl.searchParams.set("t", accessToken);
    }

    redirect(`${manageUrl.pathname}${manageUrl.search}` as never);
  }

  const data = await getBootstrap(shopId);
  const requestedStep = Number(resolvedSearchParams?.step);
  const initialFirstVisitStep = requestedStep >= 1 && requestedStep <= 4 ? (requestedStep as 1 | 2 | 3 | 4) : 1;

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode="first"
      initialDate={resolvedSearchParams?.date ?? ""}
      initialTime={resolvedSearchParams?.time ?? ""}
      initialServiceId={resolvedSearchParams?.serviceId ?? ""}
      initialServiceOptionId={resolvedSearchParams?.serviceOptionId ?? ""}
      initialFirstVisitStep={initialFirstVisitStep}
      entryHref={`/entry/${encodedShopId}`}
    />
  );
}
