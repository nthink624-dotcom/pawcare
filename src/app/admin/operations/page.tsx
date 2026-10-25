import { redirect } from "next/navigation";

import AdminOperationsSummary from "@/components/admin/admin-operations-summary";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminOperationsPage() {
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login?next=%2Fadmin%2Foperations" as never);
  return <AdminOperationsSummary />;
}
