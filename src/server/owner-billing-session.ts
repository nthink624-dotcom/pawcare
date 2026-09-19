import { NextRequest } from "next/server";

import type { BillingIdentity } from "@/server/owner-billing";
import { OwnerBillingError } from "@/server/owner-billing";
import { OwnerApiError, requireCanonicalOwnerIdentity } from "@/server/owner-api-auth";

type OwnerBillingSession = {
  identity: BillingIdentity;
  shopId: string;
};

export async function requireOwnerBillingSession(
  request: NextRequest,
  requestedShopId?: string | null,
): Promise<OwnerBillingSession> {
  try {
    // Billing recovery must remain reachable when a subscription is expired, so this
    // verifies canonical owner-only shop access without applying the active-subscription gate.
    const owner = await requireCanonicalOwnerIdentity(
      request,
      requestedShopId ?? request.nextUrl.searchParams.get("shopId") ?? undefined,
    );
    if (!owner.userId) {
      throw new OwnerBillingError("서버 결제 설정을 확인해 주세요.", 503);
    }

    return {
      identity: {
        id: owner.userId,
        email: owner.email,
        created_at: owner.createdAt,
        user_metadata: owner.userMetadata,
      },
      shopId: owner.shopId,
    };
  } catch (error) {
    if (error instanceof OwnerBillingError) throw error;
    if (error instanceof OwnerApiError) {
      throw new OwnerBillingError(error.message, error.status);
    }
    throw new OwnerBillingError("결제 관리 권한을 확인하지 못했습니다.", 500);
  }
}
