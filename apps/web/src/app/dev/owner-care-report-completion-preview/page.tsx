import { notFound } from "next/navigation";

import { OwnerCareReportCompletionPreviewClient } from "./owner-care-report-completion-preview-client";

export default function OwnerCareReportCompletionPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <OwnerCareReportCompletionPreviewClient />;
}
