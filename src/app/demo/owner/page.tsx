import OwnerApp from "@/components/owner/owner-app";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function DemoOwnerPage() {
  const data = await getBootstrap("demo-shop");

  return (
    <div className="owner-font">
      <OwnerApp
        initialData={data}
        isPreviewDemo
        ownedShops={[
          {
            id: data.shop.id,
            name: data.shop.name,
            address: data.shop.address,
            heroImageUrl: data.shop.customer_page_settings?.hero_image_url || "",
          },
        ]}
        selectedShopId={data.shop.id}
        userEmail="demo@meongmanager.kr"
        onSwitchShop={async () => {}}
      />
    </div>
  );
}
