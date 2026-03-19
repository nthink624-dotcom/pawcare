import CustomerHomePreview from "@/components/customer/customer-home-preview";
import type { Service, Shop } from "@/types/domain";

export default function LandingPage({ shop, services }: { shop: Shop; services: Service[] }) {
  return <div className="mx-auto min-h-screen w-full max-w-[430px] bg-[var(--background)] px-5 pb-10 pt-5"><CustomerHomePreview shop={shop} settings={shop.customer_page_settings} services={services} ctaHref={`/book/${shop.id}`} /></div>;
}
