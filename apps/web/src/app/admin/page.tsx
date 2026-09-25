import { redirect } from "next/navigation";

import AdminHome from "@/components/admin/admin-home";
import { getAdminAccountById } from "@/server/admin-account";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login" as never);
  }

  let adminName = "관리자님";
  try {
    const account = await getAdminAccountById(session.accountId);
    adminName = account?.fullName.trim() || adminName;
  } catch {
    // 로그인 세션은 유효하므로 표시명 조회 실패만 안전한 기본값으로 대체한다.
  }

  return <AdminHome adminName={adminName} />;
}
