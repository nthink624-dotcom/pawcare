import { redirect } from "next/navigation";

import AdminAuditLogScreen from "@/components/admin/admin-audit-log-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminAuditPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Faudit" as never);
  }

  return <AdminAuditLogScreen />;
}
