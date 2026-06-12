import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { defaultOwnerWebStaff } from "@/components/owner-web/owner-web-staff-data";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export default async function DemoOwnerWebPage() {
  const data = buildOwnerDemoBootstrap();
  return <OwnerWebPreview initialData={data} demoStaffFallback={defaultOwnerWebStaff} />;
}
