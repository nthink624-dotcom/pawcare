import ShopInfoPage from "@/components/customer/shop-info-page";
import { getBootstrap } from "@/server/bootstrap";

export default async function DemoBookInfoPage() {
  const data = await getBootstrap("demo-shop");

  return <ShopInfoPage shop={data.shop} services={data.services} backHref="/demo/book" />;
}
