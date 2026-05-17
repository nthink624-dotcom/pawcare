import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { defaultOwnerWebStaff } from "@/components/owner-web/owner-web-staff-data";
import { getBootstrap } from "@/server/bootstrap";

export default async function DemoOwnerWebPage() {
  const data = await getBootstrap("demo-shop");
  return <OwnerWebPreview initialData={data} demoStaffFallback={defaultOwnerWebStaff} />;
}
