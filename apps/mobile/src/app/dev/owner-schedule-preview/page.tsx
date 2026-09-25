import { notFound } from "next/navigation";

import OwnerLandingEmbed from "@/components/owner/owner-landing-embed";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export default async function OwnerSchedulePreviewPage({ searchParams }: {
  searchParams: Promise<{ staff?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  const staffMode = (await searchParams).staff;
  const source = buildOwnerDemoBootstrap();
  const singleStaff = source.staffMembers[0];
  const data = staffMode === "single" && singleStaff
    ? {
        ...source,
        staffMembers: [singleStaff],
        appointments: source.appointments.filter((appointment) => appointment.staff_id === singleStaff.id),
        staffScheduleOverrides: source.staffScheduleOverrides?.filter((override) => override.staff_id === singleStaff.id),
      }
    : source;

  return <OwnerLandingEmbed data={data} />;
}
