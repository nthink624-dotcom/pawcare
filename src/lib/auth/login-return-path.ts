import { PUBLIC_ACCOUNT_DELETION_PATH } from "@/lib/legal/legal-info";

const OWNER_ROUTE_PREFIX = "/owner";

export function getSafeOwnerLoginReturnPath(value: string | undefined) {
  const candidate = value?.trim() ?? "";

  if (candidate === PUBLIC_ACCOUNT_DELETION_PATH) {
    return PUBLIC_ACCOUNT_DELETION_PATH;
  }

  if (
    candidate === OWNER_ROUTE_PREFIX ||
    candidate.startsWith(`${OWNER_ROUTE_PREFIX}/`) ||
    candidate.startsWith(`${OWNER_ROUTE_PREFIX}?`) ||
    candidate.startsWith(`${OWNER_ROUTE_PREFIX}#`)
  ) {
    return candidate;
  }

  return OWNER_ROUTE_PREFIX;
}
