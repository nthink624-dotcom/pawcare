import { notFound } from "next/navigation";

import OwnerFeedbackDevPreview from "@/components/owner/owner-feedback-dev-preview";

export default function OwnerFeedbackDevPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  return <OwnerFeedbackDevPreview />;
}
