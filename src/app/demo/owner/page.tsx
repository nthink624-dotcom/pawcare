"use client";

import OwnerApp from "@/components/owner/owner-app";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export default function DemoOwnerPage() {
  const data = buildOwnerDemoBootstrap();

  return (
    <OwnerApp
      initialData={data}
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
  );
}
