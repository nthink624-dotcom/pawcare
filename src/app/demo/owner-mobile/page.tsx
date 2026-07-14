import OwnerApp from "@/components/owner/owner-app";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export const dynamic = "force-dynamic";

export default function DemoOwnerMobilePage() {
  const data = buildOwnerDemoBootstrap();

  return (
    <OwnerApp
      initialData={data}
      ownedShops={[
        {
          id: data.shop.id,
          name: data.shop.name,
          address: data.shop.address,
          heroImageUrl: data.shop.customer_page_settings.hero_image_url,
        },
      ]}
      selectedShopId={data.shop.id}
      isPreviewDemo
      appRole="owner"
    />
  );
}
