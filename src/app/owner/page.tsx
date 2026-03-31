import OwnerShell from "@/components/owner/owner-shell";
import { getBootstrap } from "@/server/repositories/app-repository";
import { requireOwnerPageAccess } from "@/server/owner-auth";

export default async function OwnerPage() {
  const { shopId, userEmail } = await requireOwnerPageAccess();
  const data = await getBootstrap(shopId);

  return <OwnerShell initialData={data} userEmail={userEmail} />;
}
