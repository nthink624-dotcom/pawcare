import { redirect } from "next/navigation";

import AgentControlPlanePreview from "@/components/admin/agent-control-plane-preview";
import { getAdminAccountById } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AgentControlPlanePreviewPage() {
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login" as never);
  const account = await getAdminAccountById(session.accountId);
  if (!account?.isActive) redirect("/admin/login" as never);
  return <AgentControlPlanePreview mode="operational" />;
}
