import type { CustomerGradeOverride, CustomerVisitType } from "@/types/domain";

export function getTodayBookingCustomerGradeLabel({
  visitType,
  gradeOverride,
}: {
  visitType?: CustomerVisitType | null;
  gradeOverride?: CustomerGradeOverride | null;
}) {
  if (visitType === "first_visit") return "신규 고객";
  if (gradeOverride === "loyal") return "단골";
  return null;
}
