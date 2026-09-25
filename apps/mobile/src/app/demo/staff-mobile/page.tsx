import OwnerApp from "@/components/owner/owner-app";
import { buildOwnerDemoBootstrap } from "@/lib/owner-demo-data";

export const dynamic = "force-dynamic";

export default function DemoStaffMobilePage() {
  const data = buildOwnerDemoBootstrap();
  const currentStaff = data.staffMembers.find((staffMember) => staffMember.id === "staff-woojin") ?? data.staffMembers[0] ?? null;

  return (
    <OwnerApp
      initialData={data}
      ownedShops={[
        {
          id: data.shop.id,
          name: data.shop.name,
          address: data.shop.address,
          heroImageUrl: data.shop.customer_page_settings.hero_image_url,
        },
      ]}
      selectedShopId={data.shop.id}
      isPreviewDemo
      appRole="staff"
      currentStaffId={currentStaff?.id ?? null}
    />
  );
}
