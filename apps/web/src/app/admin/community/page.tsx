import { redirect } from "next/navigation";
import AdminCommunityScreen from "@/components/admin/admin-community-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminCommunityPage() {
  if (!await getServerAdminSession()) redirect("/admin/login" as never);
  return <AdminCommunityScreen />;
}
