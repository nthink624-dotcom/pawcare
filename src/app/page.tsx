import LandingPage from "@/components/landing/landing-page";
import { getBootstrap } from "@/server/bootstrap";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getBootstrap("demo-shop");
  return <LandingPage shop={data.shop} services={data.services.filter((item) => item.is_active)} />;
}

