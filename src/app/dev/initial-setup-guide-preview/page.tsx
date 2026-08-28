import { notFound } from "next/navigation";

import InitialSetupGuidePreviewClient from "./initial-setup-guide-preview-client";

export default function InitialSetupGuidePreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return <InitialSetupGuidePreviewClient />;
}
