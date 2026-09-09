import { redirect } from "next/navigation";

import AdminTesterFeedbackScreen from "@/components/admin/admin-tester-feedback-screen";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminTesterFeedbackPage() {
  const session = await getServerAdminSession();
  if (!session) redirect("/admin/login?next=%2Fadmin%2Ftester-feedback" as never);
  return <AdminTesterFeedbackScreen />;
}
