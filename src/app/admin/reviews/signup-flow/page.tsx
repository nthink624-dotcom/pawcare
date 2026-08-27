import { notFound, redirect } from "next/navigation";

import SignupFlowReviewGallery from "@/components/admin/signup-flow-review-gallery";
import { getServerAdminSession } from "@/server/admin-session";
import { getSignupFlowReviewManifest } from "@/server/signup-flow-review";

export default async function SignupFlowReviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login" as never);
  return <SignupFlowReviewGallery manifest={await getSignupFlowReviewManifest()} />;
}
