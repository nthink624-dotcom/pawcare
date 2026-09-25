import { redirect } from "next/navigation";

import AdminSupportRequestScreen from "@/components/admin/admin-support-request-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminSupportPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  return <AdminSupportRequestScreen />;
}
