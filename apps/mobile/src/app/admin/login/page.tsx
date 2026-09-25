import { redirect } from "next/navigation";

import AdminLoginForm from "@/components/admin/admin-login-form";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const nextPath = typeof params.next === "string" && params.next.startsWith("/") ? params.next : "/admin";
  const session = await getServerAdminSession();

  if (session) {
    redirect(nextPath as never);
  }

  return <AdminLoginForm nextPath={nextPath} />;
}
