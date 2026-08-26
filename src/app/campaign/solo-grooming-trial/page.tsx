import { notFound } from "next/navigation";

import SoloGroomingTrialPreview from "@/components/campaign/solo-grooming-trial-preview";

export default function SoloGroomingTrialPage() {
  if (process.env.CAMPAIGN_SOLO_GROOMING_PREVIEW_ENABLED !== "true") notFound();
  return <SoloGroomingTrialPreview />;
}

