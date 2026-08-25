import { OwnerCareReportCompletionPreviewClient } from "@/app/dev/owner-care-report-completion-preview/owner-care-report-completion-preview-client";

type OwnerCareReportCompletionDemoPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function OwnerCareReportCompletionDemoPage({
  searchParams,
}: OwnerCareReportCompletionDemoPageProps) {
  const { mode } = await searchParams;
  return <OwnerCareReportCompletionPreviewClient readOnly={mode === "landing"} />;
}
