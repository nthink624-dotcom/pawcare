import { NextRequest } from "next/server";
import { ownerMobileCorsJson, ownerMobileCorsPreflight } from "@/server/owner-mobile-cors";
import { listOpenSupportPrograms } from "@/server/support-programs";

export async function GET(request: NextRequest) {
  try {
    const programs = await listOpenSupportPrograms();
    return ownerMobileCorsJson(request, { programs }, { headers: { "Cache-Control": "public, max-age=300, s-maxage=1800", Vary: "Origin" } });
  } catch {
    return ownerMobileCorsJson(request, { message: "지원사업 공고를 불러오지 못했어요." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export function OPTIONS(request: NextRequest) { return ownerMobileCorsPreflight(request); }
