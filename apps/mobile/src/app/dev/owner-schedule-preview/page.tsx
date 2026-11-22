import { notFound } from "next/navigation";

import OwnerLandingEmbed from "@/components/owner/owner-landing-embed";
import OwnerApp from "@/components/owner/owner-app";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

const previewWorkingDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export default async function OwnerSchedulePreviewPage({ searchParams }: {
  searchParams: Promise<{ staff?: string | string[]; working?: string; interactive?: string }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  const params = await searchParams;
  const staffMode = params.staff;
  const source = buildOwnerDemoBootstrap();
  const singleStaff = source.staffMembers[0];
  let data = staffMode === "single" && singleStaff
    ? {
        ...source,
        staffMembers: [singleStaff],
        appointments: source.appointments.filter((appointment) => appointment.staff_id === singleStaff.id),
        staffScheduleOverrides: source.staffScheduleOverrides?.filter((override) => override.staff_id === singleStaff.id),
      }
    : source;

  // Preview scenarios only: keep production availability and canvas styles intact.
  if (params.working === "1") {
    data = {
      ...data,
      shop: {
        ...data.shop,
        regular_closed_days: [],
        temporary_closed_dates: [],
        business_hours: Object.fromEntries(Array.from({ length: 7 }, (_, day) => [day, { open: "09:00", close: "19:00", enabled: true }])),
      },
      staffMembers: data.staffMembers.map((staff) => ({ ...staff, defaultDays: [...previewWorkingDays] })),
      staffScheduleOverrides: [],
    };
  }

  if (params.interactive === "1") {
    return <OwnerApp initialData={data} ownedShops={[{ id: data.shop.id, name: data.shop.name, address: data.shop.address, heroImageUrl: data.shop.customer_page_settings.hero_image_url }]} selectedShopId={data.shop.id} isPreviewDemo appRole="owner" />;
  }

  return <OwnerLandingEmbed data={data} />;
}
