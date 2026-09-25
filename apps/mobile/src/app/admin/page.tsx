import { redirect } from "next/navigation";

import AdminDashboard from "@/components/admin/admin-dashboard";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  return <AdminDashboard sessionLoginId={session.loginId} />;
}
