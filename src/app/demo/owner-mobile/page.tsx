import OwnerApp from "@/components/owner/owner-app";
import { getLandingDemoShopId } from "@/lib/development-demo";
import { withLandingDemoProfiles } from "@/lib/landing-demo-profile";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoOwnerMobilePage() {
  const data = withLandingDemoProfiles(await getBootstrap(getLandingDemoShopId()));
  return <OwnerApp initialData={data} ownedShops={[]} selectedShopId={data.shop.id} isPreviewDemo />;
}
