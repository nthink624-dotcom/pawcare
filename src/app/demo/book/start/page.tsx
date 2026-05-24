import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoBookPage({
  searchParams,
}: {
  searchParams?: Promise<{ mode?: string; token?: string; date?: string; time?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const initialAccessToken = resolvedSearchParams?.token;
  const initialDate = resolvedSearchParams?.date || "";
  const initialTime = resolvedSearchParams?.time || "";
  const initialMode = requestedMode === "manage" ? "manage" : "first";
  const data = await getBootstrap("demo-shop");

  return (
    <CustomerBookingPage
      shopId="demo-shop"
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialAppointments={data.appointments}
      initialRecords={data.groomingRecords}
      initialMode={initialMode}
      initialAccessToken={initialAccessToken}
      initialDate={initialDate}
      initialTime={initialTime}
      entryHref="/demo/book"
    />
  );
}
