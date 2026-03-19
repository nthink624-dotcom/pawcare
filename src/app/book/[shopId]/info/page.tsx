import ShopInfoPage from "@/components/customer/shop-info-page";
import { getBootstrap } from "@/server/repositories/app-repository";

export default async function BookShopInfoPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;
  const data = await getBootstrap(shopId);
  return <ShopInfoPage shop={data.shop} services={data.services} />;
}
