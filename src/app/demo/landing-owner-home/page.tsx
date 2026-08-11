import { LandingOwnerHomeDemo } from "@/components/landing/landing-owner-home-demo";
import { DEVELOPMENT_DEMO_SHOP_ID, isDevelopmentDemoEnvironment } from "@/lib/development-demo";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function LandingOwnerHomeDemoPage() {
  const data = await getBootstrap(isDevelopmentDemoEnvironment() ? DEVELOPMENT_DEMO_SHOP_ID : "demo-shop");
  return <LandingOwnerHomeDemo initialData={{ ...data, mode: "mock" }} />;
}
