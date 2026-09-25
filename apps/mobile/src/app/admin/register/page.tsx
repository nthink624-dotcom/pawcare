import { redirect } from "next/navigation";

import AdminRegisterForm from "@/components/admin/admin-register-form";
import { hasAnyAdminAccount } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminRegisterPage() {
  const session = await getServerAdminSession();
  const adminExists = await hasAnyAdminAccount().catch(() => false);

  if (session) {
    redirect("/admin" as never);
  }

  if (adminExists) {
    redirect("/admin/login" as never);
  }

  return <AdminRegisterForm />;
}
