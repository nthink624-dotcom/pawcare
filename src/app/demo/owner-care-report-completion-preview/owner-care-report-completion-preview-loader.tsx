"use client";

import dynamic from "next/dynamic";

const OwnerCareReportCompletionPreviewClient = dynamic(
  () =>
    import("@/app/dev/owner-care-report-completion-preview/owner-care-report-completion-preview-client").then(
      (module) => module.OwnerCareReportCompletionPreviewClient,
    ),
  {
    ssr: false,
    loading: () => (
      <main className="flex min-h-screen items-center justify-center bg-white px-4 text-center">
        <p className="text-[13px] font-medium text-[#64748b]" role="status">
          케어리포트 화면을 불러오는 중이에요
        </p>
      </main>
    ),
  },
);

export function OwnerCareReportCompletionPreviewLoader({ readOnly }: { readOnly: boolean }) {
  return <OwnerCareReportCompletionPreviewClient readOnly={readOnly} />;
}
