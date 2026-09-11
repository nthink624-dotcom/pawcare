import { notFound } from "next/navigation";

import PriceGuideInlineMatrixPreviewClient from "./price-guide-inline-matrix-preview-client";

export default function PriceGuideInlineMatrixPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <PriceGuideInlineMatrixPreviewClient />;
}
