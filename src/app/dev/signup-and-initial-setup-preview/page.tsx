import { notFound } from "next/navigation";

import SignupAndInitialSetupPreviewClient from "./signup-and-initial-setup-preview-client";

export default function SignupAndInitialSetupPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();

  return (
    <SignupAndInitialSetupPreviewClient
      visionReady={Boolean(process.env.OPENAI_API_KEY)}
    />
  );
}
