import { redirect } from "next/navigation";

import AdminAlimtalkTemplateMapping from "@/components/admin/admin-alimtalk-template-mapping";
import { ADMIN_TYPOGRAPHY } from "@/components/admin/admin-typography";
import { getServerAdminSession } from "@/server/admin-session";

export default async function AdminAlimtalkTemplatesPage() {
  const session = await getServerAdminSession();

  if (!session) {
    redirect("/admin/login?next=%2Fadmin%2Falimtalk-templates" as never);
  }

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F4F4F4] px-3 py-3 text-[#172033] sm:px-5 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1440px] overflow-hidden rounded-[14px] border border-[#D9E0E8] bg-white shadow-[0_2px_14px_rgba(15,23,42,0.10)]">
        <header className="border-b border-[#E7E7E7] px-4 py-5 sm:px-6 lg:px-8">
          <p className={`${ADMIN_TYPOGRAPHY.meta} text-[#0873C6]`}>ALIMTALK SETTINGS</p>
          <h1 className={`mt-1 tracking-[-0.03em] text-[#111112] ${ADMIN_TYPOGRAPHY.pageTitle}`}>알림톡 템플릿 설정</h1>
          <p className={`mt-2 text-[#64748B] ${ADMIN_TYPOGRAPHY.body}`}>
            승인된 예약 확정 템플릿을 선택하고 실제 발송에 적용합니다.
          </p>
        </header>
        <div className="bg-[#F4F4F4] px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          <AdminAlimtalkTemplateMapping />
        </div>
      </div>
    </main>
  );
}
