import { redirect } from "next/navigation";

import AdminNotificationFailureScreen from "@/components/admin/admin-notification-failure-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminNotificationsPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Fnotifications" as never);
  }

  return <AdminNotificationFailureScreen />;
}
