import { redirect } from "next/navigation";

import AdminAlimtalkScreen from "@/components/admin/admin-alimtalk-screen";
import { getServerAdminSession } from "@/server/admin-session";
import {
  getAdminNotificationActivity,
  getAppAlimtalkConfig,
  getAppTemplateDrafts,
} from "@/server/admin-alimtalk";

export default async function AdminAlimtalkPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  return (
    <AdminAlimtalkScreen
      sessionLoginId={session.loginId}
      appConfig={getAppAlimtalkConfig()}
      appTemplateDrafts={getAppTemplateDrafts()}
      notificationActivity={await getAdminNotificationActivity()}
    />
  );
}
