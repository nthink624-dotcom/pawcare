import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { getLandingDemoShopId } from "@/lib/development-demo";
import { withLandingDemoProfiles } from "@/lib/landing-demo-profile";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoOwnerWebPage() {
  const data = await getBootstrap(getLandingDemoShopId());
  return <OwnerWebPreview initialData={withLandingDemoProfiles(data)} />;
}
