import { notFound } from "next/navigation";

import OwnerCareReportDevPreview from "@/components/owner/owner-care-report-dev-preview";

export default function CareReportDevPreviewPage() {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  return <OwnerCareReportDevPreview />;
}
