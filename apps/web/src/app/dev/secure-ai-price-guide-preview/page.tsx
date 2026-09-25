import { notFound } from "next/navigation";

import SecureAiPriceGuidePreviewClient from "./secure-ai-price-guide-preview-client";

export default function SecureAiPriceGuidePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <SecureAiPriceGuidePreviewClient />;
}
