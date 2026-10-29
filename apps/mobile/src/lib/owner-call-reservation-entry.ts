import type { OwnerCallReservationAction } from "@/lib/owner-call-screening";
import type { Guardian } from "@/types/domain";
import { phoneNormalize } from "@/lib/utils";

// Prepare input only from a unique, active customer in the authorized bootstrap.
// A real server call event is still required before saving the reservation.
export function findPendingCallGuardian(
  guardians: Guardian[],
  action?: OwnerCallReservationAction | null,
): Guardian | null {
  if (!action?.pending || !action.providerCallId) return null;
  const phone = phoneNormalize(action.callerNumber);
  if (!phone) return null;
  const matches = guardians.filter((guardian) => !guardian.deleted_at && phoneNormalize(guardian.phone) === phone);
  return matches.length === 1 ? matches[0]! : null;
}
