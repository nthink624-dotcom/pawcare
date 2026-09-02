import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { buildDemoBootstrap } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default function DemoOwnerWebPage() {
  return <OwnerWebPreview initialData={buildDemoBootstrap()} />;
}
