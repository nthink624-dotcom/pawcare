import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { defaultOwnerWebStaff } from "@/components/owner-web/owner-web-staff-data";
import { buildDemoBootstrap } from "@/lib/mock-data";

export default async function DemoOwnerWebPage() {
  const data = buildDemoBootstrap();
  return <OwnerWebPreview initialData={data} demoStaffFallback={defaultOwnerWebStaff} />;
}
