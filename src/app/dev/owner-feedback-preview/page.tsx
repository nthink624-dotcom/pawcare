import { notFound } from "next/navigation";

import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { emptyOwnerPilotCohortProjection } from "@/lib/billing/owner-pilot-cohort";
import { buildDemoBootstrap } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function OwnerFeedbackPreviewPage({ searchParams }: {
  searchParams: Promise<{ tester?: string }>;
}) {
  if (process.env.NODE_ENV !== "development") notFound();
  const tester = (await searchParams).tester === "1";
  const data = buildDemoBootstrap();
  data.pilotCohort = {
    ...emptyOwnerPilotCohortProjection(true),
    isPilotMember: tester,
    status: tester ? "active" : null,
    statusLabel: tester ? "진행중" : null,
  };
  return <OwnerWebPreview initialData={data} feedbackFixtureMode />;
}
