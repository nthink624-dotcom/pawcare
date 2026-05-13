import OwnerWebPreview from "@/components/owner-web/owner-web-preview";
import { getBootstrap } from "@/server/bootstrap";

export default async function OwnerWebPreviewPage() {
  const data = await getBootstrap("demo-shop");
  return <OwnerWebPreview initialData={data} />;
}
