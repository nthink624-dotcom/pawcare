import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export const dynamic = "force-dynamic";

export default function DemoOwnerWebPage() {
  return <OwnerWebPreview initialData={buildOwnerDemoBootstrap()} />;
}
