import { redirect } from "next/navigation";

import AdminPilotBenefitScreen from "@/components/admin/admin-pilot-benefit-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminPilotBenefitsPage() {
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login?next=%2Fadmin%2Fpilot-benefits" as never);
  return <AdminPilotBenefitScreen />;
}
