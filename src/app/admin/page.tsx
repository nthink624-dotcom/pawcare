import { redirect } from "next/navigation";

import AdminHome from "@/components/admin/admin-home";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  return <AdminHome sessionLoginId={session.loginId} />;
}
