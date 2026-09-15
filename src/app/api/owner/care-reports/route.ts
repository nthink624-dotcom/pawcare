import type { NextRequest } from "next/server";

import { proxyCanonicalOwnerApi } from "@/lib/canonical-owner-api-proxy";

export const dynamic = "force-dynamic";

export function POST(request: NextRequest) {
  return proxyCanonicalOwnerApi(request, "/api/owner/care-reports");
}

export function PATCH(request: NextRequest) {
  return proxyCanonicalOwnerApi(request, "/api/owner/care-reports");
}
