import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { defaultOwnerWebStaff } from "@/components/owner-web/owner-web-staff-data";
import { buildDemoBootstrap } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function DemoOwnerPage() {
  const data = buildDemoBootstrap();

  return <OwnerWebPreview initialData={data} demoStaffFallback={defaultOwnerWebStaff} />;
}
