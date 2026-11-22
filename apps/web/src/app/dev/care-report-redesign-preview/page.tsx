import { notFound } from "next/navigation";

import { CareReportDesignPreview } from "./preview";

export default function CareReportRedesignPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <CareReportDesignPreview />;
}
