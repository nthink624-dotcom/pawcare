import type { CustomerGradeOverride } from "@/types/domain";

export type OwnerCustomerFilter = "all" | "loyal" | "first_visit";

type CanonicalCustomerFilterProjection = {
  customerGradeOverride?: CustomerGradeOverride | null;
  hasFirstVisit: boolean;
};

export function matchesCanonicalCustomerFilter(
  customer: CanonicalCustomerFilterProjection,
  filter: OwnerCustomerFilter,
) {
  if (filter === "loyal") return customer.customerGradeOverride === "loyal";
  if (filter === "first_visit") return customer.hasFirstVisit;
  return true;
}
