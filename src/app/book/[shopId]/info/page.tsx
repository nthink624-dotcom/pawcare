import ShopInfoPage from "@/components/customer/shop-info-page";
import { getPublicBootstrap } from "@/lib/api";

export default async function BookShopInfoPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const data = await getPublicBootstrap(shopId);
  return <ShopInfoPage shop={data.shop} services={data.services} />;
}
