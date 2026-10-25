import { stat } from "node:fs/promises";
import path from "node:path";

import { buildSignupFlowReviewManifest } from "@/lib/admin/signup-flow-review-contract";

export const signupFlowCaptureDirectory = path.join(
  process.cwd(),
  "artifacts",
  "screenshots",
  "signup-flow-review",
);

export async function getSignupFlowReviewManifest() {
  let generatedAt: string | null = null;
  try {
    const capture = await stat(path.join(signupFlowCaptureDirectory, "terms.png"));
    generatedAt = capture.mtime.toISOString();
  } catch {
    generatedAt = null;
  }
  return buildSignupFlowReviewManifest(generatedAt);
}
