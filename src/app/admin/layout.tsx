import { Suspense } from "react";

import AdminGlobalNav from "@/components/admin/admin-global-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><Suspense fallback={null}><AdminGlobalNav /></Suspense>{children}</>;
}
