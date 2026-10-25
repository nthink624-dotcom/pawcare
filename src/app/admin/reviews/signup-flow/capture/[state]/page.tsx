import { notFound, redirect } from "next/navigation";

import SignupFlowReviewCapture from "@/components/admin/signup-flow-review-capture";
import { signupFlowCaptureIds, type SignupFlowCaptureId } from "@/lib/admin/signup-flow-review-contract";
import { getServerAdminSession } from "@/server/admin-session";

export default async function SignupFlowCapturePage({ params }: { params: Promise<{ state: string }> }) {
  if (process.env.NODE_ENV !== "development") notFound();
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login" as never);
  const { state } = await params;
  if (!signupFlowCaptureIds.includes(state as SignupFlowCaptureId)) notFound();
  return <SignupFlowReviewCapture captureId={state as SignupFlowCaptureId} />;
}
