import CustomerShopInfoContent from "@/components/customer/customer-shop-info-content";
import type { Service, Shop } from "@/types/domain";

export default function ShopInfoPage({
  shop,
  services,
  backHref,
}: {
  shop: Shop;
  services: Service[];
  backHref?: string;
}) {
  return (
    <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] px-4 pb-10 pt-5">
      <CustomerShopInfoContent shop={shop} services={services} showBackLink backHref={backHref} />
    </div>
  );
}
