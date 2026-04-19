import { redirect } from "next/navigation";

import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookManagePage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ token?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  if (shopId === "demo-shop") {
    const nextUrl = new URL("/demo/book/manage", "http://localhost");

    if (resolvedSearchParams?.token) {
      nextUrl.searchParams.set("token", resolvedSearchParams.token);
    }

    redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
  }

  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode="manage"
      initialAccessToken={resolvedSearchParams?.token}
      entryHref={`/entry/${shopId}`}
    />
  );
}
