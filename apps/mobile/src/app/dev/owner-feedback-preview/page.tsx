import { notFound } from "next/navigation";

import OwnerFeedbackDevPreview from "@/components/owner/owner-feedback-dev-preview";

export default async function OwnerFeedbackDevPreviewPage({ searchParams }: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  if (process.env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production") notFound();
  const result = (await searchParams).result;
  return <OwnerFeedbackDevPreview submitResult={result === "failure" ? "failure" : "success"} />;
}
