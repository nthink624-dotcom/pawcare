import { redirect } from "next/navigation";

import AdminMarketingWarRoom from "@/components/admin/admin-marketing-war-room";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminMarketingPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  return <AdminMarketingWarRoom sessionLoginId={session.loginId} />;
}
