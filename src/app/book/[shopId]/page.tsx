import { redirect } from "next/navigation";

import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string; t?: string; date?: string; time?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const initialAccessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;
  const initialDate = resolvedSearchParams?.date || "";
  const initialTime = resolvedSearchParams?.time || "";
  const initialMode = requestedMode === "manage" ? "manage" : "first";

  if (shopId === "demo-shop") {
    const nextUrl = new URL(
      initialMode === "manage" ? "/demo/book/manage" : "/demo/book/start",
      "http://localhost",
    );

    if (initialMode !== "first" && initialMode !== "manage") {
      nextUrl.searchParams.set("mode", initialMode);
    }

    if (initialAccessToken) {
      nextUrl.searchParams.set("t", initialAccessToken);
    }
    if (initialDate) {
      nextUrl.searchParams.set("date", initialDate);
    }
    if (initialTime) {
      nextUrl.searchParams.set("time", initialTime);
    }

    redirect(`${nextUrl.pathname}${nextUrl.search}` as never);
  }

  const data = await getBootstrap(shopId);

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode={initialMode}
      initialAccessToken={initialAccessToken}
      initialDate={initialDate}
      initialTime={initialTime}
      entryHref={`/entry/${shopId}`}
    />
  );
}
