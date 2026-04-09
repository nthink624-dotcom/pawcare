import OwnerApp from "@/components/owner/owner-app";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export default function OwnerDemoPage() {
  const data = buildOwnerDemoBootstrap();

  return <OwnerApp initialData={data} userEmail="demo@meongmanager.kr" />;
}
