import LandingPage from "@/components/landing/landing-page";
import { getBootstrap } from "@/server/repositories/app-repository";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getBootstrap();
  return <LandingPage shop={data.shop} services={data.services.filter((item) => item.is_active)} />;
}
