import { redirect } from "next/navigation";

import AdminMarketingWarRoom from "@/components/admin/admin-marketing-war-room";
import { getAdminAccountById } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminMarketingPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  const account = await getAdminAccountById(session.accountId);
  if (!account?.isActive) redirect("/admin/login" as never);

  return <AdminMarketingWarRoom sessionLoginId={session.loginId} representative={account.isSuperAdmin} />;
}
