import { redirect } from "next/navigation";
import AdminOperationalErrors from "@/components/admin/admin-operational-errors";
import { getServerAdminSession } from "@/server/admin-session";

export default async function OperationalErrorsPage() {
  if (!await getServerAdminSession()) redirect("/admin/login?next=%2Fadmin%2Foperational-errors" as never);
  return <AdminOperationalErrors />;
}
