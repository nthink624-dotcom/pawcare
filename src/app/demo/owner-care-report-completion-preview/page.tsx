import { OwnerCareReportCompletionPreviewLoader } from "./owner-care-report-completion-preview-loader";

type OwnerCareReportCompletionDemoPageProps = {
  searchParams: Promise<{ mode?: string }>;
};

export default async function OwnerCareReportCompletionDemoPage({
  searchParams,
}: OwnerCareReportCompletionDemoPageProps) {
  const { mode } = await searchParams;
  return <OwnerCareReportCompletionPreviewLoader readOnly={mode === "landing"} />;
}
