import LandingPage from "@/components/landing/landing-page";
import { getPublicBootstrap } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getPublicBootstrap();
  return <LandingPage shop={data.shop} services={data.services.filter((item) => item.is_active)} />;
}
