import { getBootstrap } from "@/server/bootstrap";
import type { OwnerShopContext } from "@/server/owner-api-auth";
import { scopeBootstrapForStaff } from "@/server/staff-privacy";
import { getPriceGuideCoreContract, projectCanonicalPriceGuidesForRead } from "@/lib/price-guide-core";

export async function getOwnerBootstrapSnapshot(
  owner: OwnerShopContext,
  phase: "launch" | "essential" | "full",
  onTiming?: (phase: string, durationMs: number) => void,
) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
  const to = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString().slice(0, 10);
  const groomingFrom = new Date(now);
  groomingFrom.setMonth(groomingFrom.getMonth() - 3);
  const data = await getBootstrap(owner.shopId, {
    // Full refreshes retain their extras; reuse the same canonical core query
    // instead of reopening eight independent REST reads on every idle poll.
    compactOwnerRead: true,
    allowMock: false,
    includeDepositPreview: owner.role !== "staff",
    includeLanding: false,
    appointmentsFrom: from,
    appointmentsTo: to,
    groomingRecordsFrom: groomingFrom.toISOString().slice(0, 10),
    groomingRecordsTo: to,
    groomingRecordLimit: 1000,
    notificationLimit: 200,
    includeOwnerProfile: phase !== "essential",
    includeNotifications: phase === "full",
    includeAppointmentChangeEvents: phase === "full",
    includeGroomingRecords: phase === "full",
    includeOwnerExtras: phase === "full",
    includePilotCohort: phase === "full",
    includeStaffProfileImages: phase === "full",
    includePetDisplayPhotos: phase === "full",
    onTiming,
  });
  const scoped = scopeBootstrapForStaff(data, owner);
  return {
    ...scoped,
    actor: { shopId: owner.shopId, role: owner.role, staffId: owner.staffId },
    services: projectCanonicalPriceGuidesForRead(scoped.services),
    priceGuideCore: getPriceGuideCoreContract(),
  };
}
