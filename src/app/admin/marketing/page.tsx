import { redirect } from "next/navigation";

import AdminMarketingWarRoom from "@/components/admin/admin-marketing-war-room";
import AgentControlPlanePreview from "@/components/admin/agent-control-plane-preview";
import { getAdminAccountById } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminMarketingPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  const account = await getAdminAccountById(session.accountId);
  if (!account?.isActive) redirect("/admin/login" as never);

  const { view } = await searchParams;
  if (view === "details") return <AdminMarketingWarRoom sessionLoginId={session.loginId} representative={account.isSuperAdmin} />;
  return <AgentControlPlanePreview mode="operational" />;
}
