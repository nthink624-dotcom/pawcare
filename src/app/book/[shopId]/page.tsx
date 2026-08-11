import { redirect } from "next/navigation";

import CustomerBookingPage from "@/components/customer/customer-booking-page";
import { isDevelopmentDemoShopId } from "@/lib/development-demo";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ shopId: string }>;
  searchParams?: Promise<{ mode?: string; token?: string; t?: string; date?: string; time?: string; serviceId?: string; serviceOptionId?: string; step?: string; experience?: string }>;
}) {
  const { shopId } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMode = resolvedSearchParams?.mode;
  const encodedShopId = encodeURIComponent(shopId);
  const landingExperience = resolvedSearchParams?.experience;

  if (requestedMode === "manage") {
    const manageUrl = new URL(`/book/${encodedShopId}/manage`, "http://localhost");
    const accessToken = resolvedSearchParams?.t || resolvedSearchParams?.token;

    if (accessToken) {
      manageUrl.searchParams.set("t", accessToken);
    }

    redirect(`${manageUrl.pathname}${manageUrl.search}` as never);
  }

  const data = await getBootstrap(shopId);
  const requestedStep = Number(resolvedSearchParams?.step);
  const initialFirstVisitStep = requestedStep >= 1 && requestedStep <= 4 ? (requestedStep as 1 | 2 | 3 | 4) : 1;
  const initialBookingProfile =
    isDevelopmentDemoShopId(shopId) && landingExperience === "revisit"
      ? {
          ownerName: "김다은",
          phone: "010-0000-0000",
          pets: [{ id: "mong-pet-1", name: "두부", breed: "말티즈", weight: 3.8 }],
        }
      : undefined;

  return (
    <CustomerBookingPage
      shopId={shopId}
      initialShop={data.shop}
      initialServices={data.services}
      initialStaffMembers={data.staffMembers}
      initialStaffScheduleOverrides={data.staffScheduleOverrides ?? []}
      initialAppointments={data.appointments}
      initialMode="first"
      initialDate={resolvedSearchParams?.date ?? ""}
      initialTime={resolvedSearchParams?.time ?? ""}
      initialServiceId={resolvedSearchParams?.serviceId ?? ""}
      initialServiceOptionId={resolvedSearchParams?.serviceOptionId ?? ""}
      initialFirstVisitStep={initialFirstVisitStep}
      entryHref={landingExperience === "first" ? `/entry/${encodedShopId}?experience=first` : `/entry/${encodedShopId}`}
      initialBookingProfile={initialBookingProfile}
      disableStoredProfile={isDevelopmentDemoShopId(shopId) && (landingExperience === "first" || landingExperience === "revisit")}
    />
  );
}
