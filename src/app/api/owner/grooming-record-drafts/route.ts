import type { NextRequest } from "next/server";

import { proxyCanonicalOwnerApi } from "@/lib/canonical-owner-api-proxy";

export const dynamic = "force-dynamic";

export function GET(request: NextRequest) {
  return proxyCanonicalOwnerApi(request, "/api/owner/grooming-record-drafts");
}

export function PUT(request: NextRequest) {
  return proxyCanonicalOwnerApi(request, "/api/owner/grooming-record-drafts");
}

export function DELETE(request: NextRequest) {
  return proxyCanonicalOwnerApi(request, "/api/owner/grooming-record-drafts");
}
