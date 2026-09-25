import { redirect } from "next/navigation";

import ShopInfoPage from "@/components/customer/shop-info-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookShopInfoPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;

  if (shopId === "demo-shop") {
    redirect("/demo/book/info");
  }

  const data = await getBootstrap(shopId);

  return <ShopInfoPage shop={data.shop} services={data.services} />;
}
