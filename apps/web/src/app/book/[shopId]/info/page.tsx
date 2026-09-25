import ShopInfoPage from "@/components/customer/shop-info-page";
import CustomerBookingUnavailable from "@/components/customer/customer-booking-unavailable";
import { getBootstrapOwnerInitialSetupReadiness } from "@/lib/owner-initial-setup-readiness";
import { getBootstrap } from "@/server/bootstrap";

export default async function BookShopInfoPage({ params }: { params: Promise<{ shopId: string }> }) {
  const { shopId } = await params;

  const data = await getBootstrap(shopId).catch(() => null);
  if (!data || !getBootstrapOwnerInitialSetupReadiness(data).completed) {
    return <CustomerBookingUnavailable />;
  }

  return <ShopInfoPage shop={data.shop} services={data.services} />;
}
