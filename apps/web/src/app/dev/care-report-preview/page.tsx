import { notFound } from "next/navigation";

import { CustomerGroomingResultCard } from "@/components/customer/customer-grooming-result-card";

import { careReportPreviewProps } from "./fixture";

export default function CareReportPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <main className="min-h-screen bg-white px-0 py-0 sm:px-4 sm:py-8">
      <div className="mx-auto w-full max-w-[430px]">
        <CustomerGroomingResultCard {...careReportPreviewProps} />
      </div>
    </main>
  );
}
