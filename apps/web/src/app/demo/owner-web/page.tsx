import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { buildDemoBootstrap, buildDemoInitialSetupBootstrap } from "@/lib/mock-data";

export const dynamic = "force-dynamic";

export default async function DemoOwnerWebPage({
  searchParams,
}: {
  searchParams: Promise<{ initialSetup?: string | string[] }>;
}) {
  const initialSetup = (await searchParams).initialSetup;
  const initialData = initialSetup === "1"
    ? buildDemoInitialSetupBootstrap()
    : buildDemoBootstrap();

  return <OwnerWebPreview initialData={initialData} />;
}
