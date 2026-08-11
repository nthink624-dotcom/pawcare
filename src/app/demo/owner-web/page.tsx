import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { DEVELOPMENT_DEMO_SHOP_ID, isDevelopmentDemoEnvironment } from "@/lib/development-demo";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoOwnerWebPage() {
  const data = await getBootstrap(isDevelopmentDemoEnvironment() ? DEVELOPMENT_DEMO_SHOP_ID : "demo-shop");
  return <OwnerWebPreview initialData={{ ...data, mode: "mock" }} />;
}
