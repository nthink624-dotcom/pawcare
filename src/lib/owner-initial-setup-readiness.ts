import { isValidBusinessHoursRange } from "@/lib/business-hours";
import { buildCustomerServiceSourceOptions } from "@/lib/customer-service-options";
import type {
  BootstrapPayload,
  BootstrapStaffMember,
  OwnerInitialSetupReadiness,
  OwnerInitialSetupStepKey,
  Service,
  Shop,
} from "@/types/domain";

export const OWNER_INITIAL_SETUP_ORDER: OwnerInitialSetupStepKey[] = ["hours", "staff", "pricing"];

export function createIncompleteOwnerInitialSetupReadiness(shopId: string): OwnerInitialSetupReadiness {
  return {
    shopId,
    steps: { hours: false, staff: false, pricing: false },
    completed: false,
    nextStep: "hours",
  };
}

function hasReadyBusinessHours(shop: Pick<Shop, "business_hours">) {
  const configuredDays = Object.values(shop.business_hours ?? {}).filter(
    (hours): hours is NonNullable<typeof hours> => Boolean(hours),
  );
  const enabledDays = configuredDays.filter((hours) => hours.enabled);
  return enabledDays.length > 0 && enabledDays.every((hours) => isValidBusinessHoursRange(hours.open, hours.close));
}

function hasReadyStaff(staffMembers: BootstrapStaffMember[]) {
  return staffMembers.some((staff) =>
    Boolean(staff.id.trim()) &&
    Boolean(staff.name.trim()) &&
    Boolean(staff.role.trim()) &&
    staff.defaultDays.length > 0 &&
    isValidBusinessHoursRange(staff.startTime, staff.endTime),
  );
}

function hasReadyPricing(services: Service[]) {
  return buildCustomerServiceSourceOptions(services).length > 0;
}

export function deriveOwnerInitialSetupReadiness({
  shop,
  services,
  persistedStaffMembers,
}: {
  shop: Pick<Shop, "id" | "business_hours">;
  services: Service[];
  persistedStaffMembers: BootstrapStaffMember[];
}): OwnerInitialSetupReadiness {
  const steps = {
    hours: hasReadyBusinessHours(shop),
    staff: hasReadyStaff(persistedStaffMembers),
    pricing: hasReadyPricing(services),
  };
  const nextStep = OWNER_INITIAL_SETUP_ORDER.find((step) => !steps[step]) ?? null;

  return {
    shopId: shop.id,
    steps,
    completed: nextStep === null,
    nextStep,
  };
}

export function getBootstrapOwnerInitialSetupReadiness(
  data: Pick<BootstrapPayload, "shop" | "initialSetupReadiness">,
) {
  const readiness = data.initialSetupReadiness;
  if (!readiness || readiness.shopId !== data.shop.id) {
    return createIncompleteOwnerInitialSetupReadiness(data.shop.id);
  }
  return readiness;
}

export function resolveOwnerInitialSetupVisibility(
  readiness: OwnerInitialSetupReadiness,
  requestedAfterSignup: boolean,
) {
  if (readiness.completed) {
    return { showEntry: false, open: false, nextStep: null } as const;
  }

  return {
    showEntry: true,
    open: requestedAfterSignup,
    nextStep: readiness.nextStep ?? "hours",
  } as const;
}
