import { redirect } from "next/navigation";

import OwnerAdminScreen from "@/components/admin/owner-admin-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function OwnerAdminPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login?next=%2Fowner%2Fadmin" as never);
  }

  return <OwnerAdminScreen adminId={session.loginId} />;
}
