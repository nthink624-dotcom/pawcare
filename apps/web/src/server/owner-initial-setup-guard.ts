import { getBootstrapOwnerInitialSetupReadiness } from "@/lib/owner-initial-setup-readiness";
import { getBootstrap } from "@/server/bootstrap";
import { OwnerApiError } from "@/server/owner-api-auth";
import type { BootstrapPayload } from "@/types/domain";
import type { MediaKind } from "@/types/domain";

export const OWNER_INITIAL_SETUP_REQUIRED_MESSAGE = "매장 준비를 먼저 완료해 주세요";

const bootstrapOptions = {
  allowMock: false,
  includeLanding: false,
  includeNotifications: false,
  includeGroomingRecords: false,
  includeOwnerExtras: false,
  includeStaffProfileImages: false,
  includePilotCohort: false,
  includePetDisplayPhotos: false,
} as const;

export const OWNER_INITIAL_SETUP_SETTINGS_FIELDS = [
  "shopId",
  "bookingAvailableStartTime",
  "bookingAvailableEndTime",
  "regularClosedDays",
  "regularClosedCycle",
  "regularClosedAnchorDate",
  "temporaryClosedDates",
  "businessHours",
] as const;

const incompleteSetupAllowedMediaKinds = new Set<MediaKind>([
  "staff_profile",
  "price_guide_source",
  "feedback_screenshot",
]);

export function assertBootstrapOwnerInitialSetupComplete(
  data: Pick<BootstrapPayload, "shop" | "initialSetupReadiness">,
) {
  if (!getBootstrapOwnerInitialSetupReadiness(data).completed) {
    throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
  }
}

export async function assertOwnerInitialSetupComplete(
  shopId: string,
  loadBootstrap: typeof getBootstrap = getBootstrap,
) {
  await requireOwnerInitialSetupCompleteBootstrap(shopId, loadBootstrap);
}

export async function loadOwnerInitialSetupBootstrap(
  shopId: string,
  loadBootstrap: typeof getBootstrap = getBootstrap,
) {
  try {
    return await loadBootstrap(shopId, bootstrapOptions);
  } catch {
    throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
  }
}

export async function requireOwnerInitialSetupCompleteBootstrap(
  shopId: string,
  loadBootstrap: typeof getBootstrap = getBootstrap,
) {
  const data = await loadOwnerInitialSetupBootstrap(shopId, loadBootstrap);
  assertBootstrapOwnerInitialSetupComplete(data);
  return data;
}

export function assertInitialSetupSettingsPayload(input: unknown) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input) ||
    Object.keys(input).some(
      (key) => !(OWNER_INITIAL_SETUP_SETTINGS_FIELDS as readonly string[]).includes(key),
    )
  ) {
    throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
  }
}

export async function assertOwnerInitialSetupAllowsMediaKind(
  shopId: string,
  mediaKind: string | null | undefined,
  loadBootstrap: typeof getBootstrap = getBootstrap,
) {
  const data = await loadOwnerInitialSetupBootstrap(shopId, loadBootstrap);
  if (getBootstrapOwnerInitialSetupReadiness(data).completed) return;
  if (incompleteSetupAllowedMediaKinds.has(mediaKind as MediaKind)) return;
  throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
}

export async function assertOwnerInitialSetupAllowsStoredMedia(
  shopId: string,
  resolveMediaKind: () => Promise<MediaKind>,
  loadBootstrap: typeof getBootstrap = getBootstrap,
) {
  const data = await loadOwnerInitialSetupBootstrap(shopId, loadBootstrap);
  if (getBootstrapOwnerInitialSetupReadiness(data).completed) return;
  try {
    const mediaKind = await resolveMediaKind();
    if (incompleteSetupAllowedMediaKinds.has(mediaKind)) return;
  } catch {
    // A missing or unreadable asset cannot establish a setup-safe purpose.
  }
  throw new OwnerApiError(OWNER_INITIAL_SETUP_REQUIRED_MESSAGE, 409);
}
