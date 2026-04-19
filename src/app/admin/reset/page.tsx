import { redirect } from "next/navigation";

import AdminResetPasswordForm from "@/components/admin/admin-reset-password-form";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminResetPage() {
  const session = await getServerAdminSession();

  if (session) {
    redirect("/admin" as never);
  }

  return <AdminResetPasswordForm />;
}
